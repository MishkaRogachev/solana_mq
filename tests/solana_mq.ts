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

    // Airdrop SOL to the new user
    const airdropSignature = await provider.connection.requestAirdrop(
      user,
      anchor.web3.LAMPORTS_PER_SOL // 1 SOL
    );

    // Confirm the airdrop using the new TransactionConfirmationStrategy
    await provider.connection.confirmTransaction(
      airdropSignature, // Pass the signature directly
      "confirmed" // Specify the commitment level here
    );

    console.log(`Airdropped 1 SOL to: ${user.toBase58()}`);
    const topicName = "MyTestTopic";

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
    console.log("Topic created successfully.");

    const response = await program.account.topics.fetch(topicsPda);
    assert.ok(response.topics.length > 0, "No topics found.");
    assert.ok(response.topics.at(0) === topicName, "Topic name mismatch.");

    console.log("Topics: ", response.topics);
  });
});
