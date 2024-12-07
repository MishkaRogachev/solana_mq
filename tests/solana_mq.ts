import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaMq } from "../target/types/solana_mq";
import { assert } from "chai";

async function airdrop(provider, user, lamports) {
  const airdropSignature = await provider.connection.requestAirdrop(user, lamports);
  const latestBlockHash = await provider.connection.getLatestBlockhash();

  await provider.connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature: airdropSignature,
  });

  console.log(`Airdropped ${lamports / anchor.web3.LAMPORTS_PER_SOL} SOL to: ${user.toBase58()}`);
}

describe("solana_mq", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolanaMq as Program<SolanaMq>;

  it("Topic CRUD operations", async () => {
    const userKeypair = anchor.web3.Keypair.generate();
    const user = userKeypair.publicKey;
    const firstTopic = "/test_topic_1";
    const secondTopic = "/test_topic_2";

    // Airdrop!
    await airdrop(provider, user, 1 * anchor.web3.LAMPORTS_PER_SOL);

    // Check initial balance
    let balance = await provider.connection.getBalance(user);
    console.log(`Initial balance: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);

    // Derive the PDA for the Topics account
    const [topicsPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("topics"), user.toBuffer()],
      program.programId
    );

    // Initialize Topics account
    await program.methods
      .initialise()
      .accounts({
        user,
      })
      .signers([userKeypair])
      .rpc();

    console.log("Topics account initialized.");
    balance = await provider.connection.getBalance(user);
    console.log(`Balance after initialization: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);

    // Create first topic
    await program.methods
      .createTopic(firstTopic)
      .accounts({
        user,
      })
      .signers([userKeypair])
      .rpc();

    let response = await program.account.topics.fetch(topicsPda);
    assert.strictEqual(response.topics.length, 1, "Should have 1 topic.");
    assert.strictEqual(response.topics[0], firstTopic, "First topic mismatch.");
    console.log("First topic created successfully.");

    // Create second topic
    await program.methods
      .createTopic(secondTopic)
      .accounts({
        user,
      })
      .signers([userKeypair])
      .rpc();

    response = await program.account.topics.fetch(topicsPda);
    assert.strictEqual(response.topics.length, 2, "Should have 2 topics.");
    assert.strictEqual(response.topics[1], secondTopic, "Second topic mismatch.");
    console.log("Second topic created successfully.");

    // Remove first topic
    await program.methods
      .removeTopic(firstTopic)
      .accounts({
        user,
      })
      .signers([userKeypair])
      .rpc();

    response = await program.account.topics.fetch(topicsPda);
    assert.strictEqual(response.topics.length, 1, "Should have 1 topic.");
    assert.strictEqual(response.topics[0], secondTopic, "First topic mismatch.");
    console.log("First topic removed successfully.");

    // Remove second topic
    await program.methods
      .removeTopic(secondTopic)
      .accounts({
        user,
      })
      .signers([userKeypair])
      .rpc();

    response = await program.account.topics.fetch(topicsPda);
    assert.strictEqual(response.topics.length, 0, "Should have 0 topics.");
    console.log("Second topic removed successfully.");

    // Cleanup
    await program.methods
      .deinitialise()
      .accounts({
        user,
      })
      .signers([userKeypair])
      .rpc();

    console.log("Topics account deinitialised.");
    balance = await provider.connection.getBalance(user);
    console.log(`Final balance after deinitialisation: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);
  });
});
