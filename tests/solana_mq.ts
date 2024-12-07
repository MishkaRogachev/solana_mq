import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaMq } from "../target/types/solana_mq";
import { assert } from "chai";

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

    console.log(`Topics account initialized. Balance: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);
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

    console.log(`Topics account deinitialized. Balance: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);
}

async function createTopic(program: Program<SolanaMq>, userKeypair: anchor.web3.Keypair, topic: string) {
  const user = userKeypair.publicKey;
  await program.methods
    .createTopic(topic)
    .accounts({
      user,
    })
    .signers([userKeypair])
    .rpc();

  console.log(`Topic created: ${topic}`);
}

async function removeTopic(program: Program<SolanaMq>, userKeypair: anchor.web3.Keypair, topic: string) {
  const user = userKeypair.publicKey;
  await program.methods
    .removeTopic(topic)
    .accounts({
      user,
    })
    .signers([userKeypair])
    .rpc();

  console.log(`Topic removed: ${topic}`);
}

describe("solana_mq", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolanaMq as Program<SolanaMq>;

  it("Topic CRUD operations", async () => {
    const userKeypair = anchor.web3.Keypair.generate();
    const topics = Array.from({ length: 8 }, (_, i) => `/test_topic_${i + 1}`);

    // Airdrop!
    await airdrop(provider, userKeypair.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);

    // Derive the PDA for the Topics account
    const [topicsPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("topics"), userKeypair.publicKey.toBuffer()],
      program.programId
    );

    // Initialize Topics account
    await initialise(provider, program, userKeypair);

    let response = await program.account.topics.fetch(topicsPda);
    assert.strictEqual(response.topics.length, 0, "Should have 0 topics.");

    // Create all topics
    for (const [i, topic] of topics.entries()) {
      await createTopic(program, userKeypair, topic);

      response = await program.account.topics.fetch(topicsPda);
      assert.strictEqual(response.topics.length, i + 1, `Should have ${i + 1} topics.`);
      assert.strictEqual(
        response.topics[response.topics.length - 1],
        topic,
        `Latest topic mismatch after adding topic ${i + 1}.`
      );
    }

    // Remove all topics one by one and validate after each removal
    for (const [i, topic] of [...topics].reverse().entries()) {
      await removeTopic(program, userKeypair, topic);

      response = await program.account.topics.fetch(topicsPda);
      const remainingTopics = topics.length - (i + 1);
      assert.strictEqual(response.topics.length, remainingTopics, `Should have ${remainingTopics} topics.`);
      if (remainingTopics > 0) {
        assert.strictEqual(
          response.topics[response.topics.length - 1],
          topics[remainingTopics - 1],
          `Latest topic mismatch after removing topic ${i + 1}.`
        );
      }
    }

    // Cleanup
    await deinitialise(provider, program, userKeypair);
  });
});
