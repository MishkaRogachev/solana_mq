import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";

async function airdrop(provider: anchor.AnchorProvider, publicKey: anchor.web3.PublicKey, lamports: number) {
  const airdropSignature = await provider.connection.requestAirdrop(publicKey, lamports);
  const latestBlockHash = await provider.connection.getLatestBlockhash();

  await provider.connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature: airdropSignature,
  });

  console.log(`Airdropped ${lamports / anchor.web3.LAMPORTS_PER_SOL} SOL to: ${publicKey.toBase58()}`);
}

describe("solana_mq", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolanaMq;

  it("User creates a hub & publishes a message", async () => {
    const user = anchor.web3.Keypair.generate();
    const topic = "/test_topic";
    const message = "Hello, World!";

    await airdrop(provider, user.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);

    const [hubKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("hub"), user.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .createHub()
      .accounts({ rentPayer: user.publicKey })
      .signers([user])
      .rpc();

    // Check balance after hub creation
    let balance = await provider.connection.getBalance(user.publicKey);
    console.log(`Hub crated, balance: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);

    // Verify hub fields
    const hubAccount = await program.account.hub.fetch(hubKey);
    assert.strictEqual(hubAccount.owner.toBase58(), user.publicKey.toBase58(), "Hub owner mismatch");

    const createdAt = hubAccount.createdAt.toNumber(); // Convert BN to number
    assert.isNumber(createdAt, "Hub creation timestamp is not a number");
    assert.isAbove(createdAt, 0, "Hub creation timestamp should be greater than zero");

    // Set up event listener
    const listener = program.addEventListener("publication", (event: any) => {
      assert.strictEqual(event.hub.toBase58(), hubKey.toBase58(), "Event hub mismatch");
      assert.strictEqual(event.publisher.toBase58(), user.publicKey.toBase58(), "Event publisher mismatch");
      assert.strictEqual(event.topic, topic, "Event topic mismatch");
      assert.strictEqual(event.message, message, "Event message mismatch");
      console.log(`Published: '${event.message}' on topic '${event.topic}'`);
    });

    // Publish a valid message
    await program.methods
      .publish(topic, message)
      .accounts({ publisher: user.publicKey, hub: hubKey })
      .signers([user])
      .rpc();

    // Close the hub
    await program.methods
      .closeHub()
      .accounts({ rentPayer: user.publicKey })
      .signers([user])
      .rpc();

    let refunded_balance = await provider.connection.getBalance(user.publicKey);
    let refunded = refunded_balance - balance;
    console.log(`Hub closed, refunded: ${(refunded) / anchor.web3.LAMPORTS_PER_SOL} SOL`);

    assert.ok(refunded > 0);

    await program.removeEventListener(listener);
  });
});
