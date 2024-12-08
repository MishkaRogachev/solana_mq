import * as anchor from "@coral-xyz/anchor";

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

  it("Alice creates a hub, Bob subscribes, and Alice publishes messages", async () => {
    const alice = anchor.web3.Keypair.generate();
    const bob = anchor.web3.Keypair.generate();

    const topic = "/topic_1";

    await airdrop(provider, alice.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await airdrop(provider, bob.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);

    const [hubKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("hub"), alice.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .createHub()
      .accounts({ rentPayer: alice.publicKey })
      .signers([alice])
      .rpc();

    await program.methods
      .subscribe(topic)
      .accounts({ subscriber: bob.publicKey, hub: hubKey })
      .signers([bob])
      .rpc();

    const listener = program.addEventListener("publication", (event: any) => {
      console.log(`Subscriber ${event.subscriber} received: '${event.message}' on topic '${event.topic}'`);
    });

    console.log("Alice publishes a message");
    await program.methods
      .publish(topic, "Hello, Bob!")
      .accounts({ publisher: alice.publicKey, hub: hubKey })
      .signers([alice])
      .rpc();

    await program.removeEventListener(listener);

    await program.methods
      .closeHub()
      .accounts({ rentPayer: alice.publicKey })
      .signers([alice])
      .rpc();
  });

  it("Alice creates a hub, Alice subscribes, and Bob publishes messages", async () => {
    const alice = anchor.web3.Keypair.generate();
    const bob = anchor.web3.Keypair.generate();

    const topic = "/topic_2";

    await airdrop(provider, alice.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await airdrop(provider, bob.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);

    const [hubKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("hub"), alice.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .createHub()
      .accounts({ rentPayer: alice.publicKey })
      .signers([alice])
      .rpc();

    await program.methods
      .subscribe(topic)
      .accounts({ subscriber: alice.publicKey, hub: hubKey })
      .signers([alice])
      .rpc();

    const listener = program.addEventListener("publication", (event: any) => {
      console.log(`Subscriber ${event.subscriber} received: '${event.message}' on topic '${event.topic}'`);
    });

    console.log("Bob publishes a message");
    await program.methods
      .publish(topic, "Hello, Alice!")
      .accounts({ publisher: bob.publicKey, hub: hubKey })
      .signers([bob])
      .rpc();

    await program.removeEventListener(listener);

    await program.methods
      .closeHub()
      .accounts({ rentPayer: alice.publicKey })
      .signers([alice])
      .rpc();
  });
});
