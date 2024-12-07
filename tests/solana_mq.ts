import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaMq } from "../target/types/solana_mq";

async function airdrop(provider: anchor.AnchorProvider, publicKey: anchor.web3.PublicKey, lamports: number) {
  const airdropSignature = await provider.connection.requestAirdrop(publicKey, lamports);
  const latestBlockHash = await provider.connection.getLatestBlockhash();

  await provider.connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature: airdropSignature,
  });

  let balance = await provider.connection.getBalance(publicKey);

  console.log(`Airdropped ${lamports / anchor.web3.LAMPORTS_PER_SOL} SOL to: ${publicKey.toBase58()}. Balance: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);
}

async function initialise(provider: anchor.AnchorProvider, program: Program<SolanaMq>, userKeypair: anchor.web3.Keypair) {
  const user = userKeypair.publicKey;
  await program.methods
    .initialise()
    .accounts({
      user,
    })
    .signers([userKeypair])
    .rpc();

    let balance = await provider.connection.getBalance(userKeypair.publicKey);

    console.log(`Account initialized. Balance: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);
}

async function deinitialise(provider: anchor.AnchorProvider, program: Program<SolanaMq>, userKeypair: anchor.web3.Keypair) {
  const user = userKeypair.publicKey;
  await program.methods
    .deinitialise()
    .accounts({
      user,
    })
    .signers([userKeypair])
    .rpc();

    let balance = await provider.connection.getBalance(userKeypair.publicKey);

    console.log(`Account deinitialized. Balance: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);
}

async function subscribeTopic(program: Program<SolanaMq>, subscriberKeypair: anchor.web3.Keypair, publisher: anchor.web3.PublicKey, topicName: string): Promise<void> {
  const subscriber: anchor.web3.PublicKey = subscriberKeypair.publicKey;

  await program.methods
    .subscribe(topicName)
    .accounts({
      subscriber,
      publisher,
    })
    .signers([subscriberKeypair])
    .rpc();

  console.log(`User ${subscriber.toBase58()} subscribed on ${publisher.toBase58()}:${topicName}`);
}

async function publishMessage(program: Program<SolanaMq>, publisherKeypair: anchor.web3.Keypair, topic: string, message: string) {
  const publisher = publisherKeypair.publicKey;
  console.log(`User ${publisher.toBase58()} publishing on topic '${topic}': ${message}`);

  await program.methods
    .publish(topic, message)
    .accounts({
      publisher,
    })
    .signers([publisherKeypair])
    .rpc();
}

async function listenForPublications(program: Program<SolanaMq>): Promise<number> {
  const listener = program.addEventListener("publication", (event) => {
    console.log(`User ${event.subscriber} received: '${event.message}' on topic '${event.topic}' from: ${event.publisher}, `);
  });
  return listener;
}

describe("solana_mq", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolanaMq;

  it("Alice publishing to Bob", async () => {
    const alice = anchor.web3.Keypair.generate();
    const bob = anchor.web3.Keypair.generate();

    const topic = "/my_topic";

    await airdrop(provider, alice.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
    await initialise(provider, program, alice);
    await subscribeTopic(program, bob, alice.publicKey, topic);

    const listener = await listenForPublications(program);

    await publishMessage(program, alice, topic, "Hello, Bob!");
    await publishMessage(program, alice, topic, "How are you doing?");

    await new Promise((resolve) => setTimeout(resolve, 1000));
    await program.removeEventListener(listener);

    await deinitialise(provider, program, alice);
  });
});
