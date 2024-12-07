import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaMq } from "../target/types/solana_mq";
import { assert } from "chai";

describe("solana_mq", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolanaMq as Program<SolanaMq>;

  it("Topic CRUD operations", async () => {
    // Generate a random keypair for the user
    const userKeypair = anchor.web3.Keypair.generate();
    const user = userKeypair.publicKey;
    const topicName = "MyTestTopic";

    // Airdrop SOL to the new user
    const airdropSignature = await provider.connection.requestAirdrop(
      user,
      anchor.web3.LAMPORTS_PER_SOL // 1 SOL
    );

    const latestBlockHash = await provider.connection.getLatestBlockhash();

    await provider.connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: airdropSignature,
    });

    console.log(`Airdropped 1 SOL to: ${user.toBase58()}`);

    // Get initial balance
    const initialBalance = await provider.connection.getBalance(user);

    // Derive the PDA for the Topics account
    const [topicsPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("topics"), user.toBuffer()],
      program.programId
    );

    // Call the createTopic method
    await program.methods
      .createTopic(topicName)
      .accounts({
        user,
      })
      .signers([userKeypair]) // Include the userKeypair in the signers
      .rpc();

    let response = await program.account.topics.fetch(topicsPda);
    assert.ok(response.topics.length > 0, "No topics found.");
    assert.ok(response.topics.at(0) === topicName, "Topic name mismatch.");
    console.log("Topic created successfully.");

    let balanceAfterCreate = await provider.connection.getBalance(user);
    let createCost = (initialBalance - balanceAfterCreate) / anchor.web3.LAMPORTS_PER_SOL;
    console.log(`Cost of createTopic: ${createCost} SOL`);

    // Call the removeTopic
    await program.methods
      .removeTopic(topicName)
      .accounts({
        user,
      })
      .signers([userKeypair]) // Sign with the userKeypair
      .rpc();

    response = await program.account.topics.fetch(topicsPda);
    assert.ok(response.topics.length === 0, "Topic not removed.");
    console.log("Topic removed successfully.");

    let balanceAfterRemove = await provider.connection.getBalance(user);
    let removeCost = (balanceAfterCreate - balanceAfterRemove) / anchor.web3.LAMPORTS_PER_SOL;
    console.log(`Cost of removeTopic: ${removeCost} SOL`);
  });
});
