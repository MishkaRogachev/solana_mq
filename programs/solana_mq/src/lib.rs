use anchor_lang::prelude::*;

declare_id!("9tgFGPhuMsuXUUAWFNfuFEpBuANtjvwDdu9maFVFbLfo");

const ANCHOR_DESCRIMINATOR_SIZE: usize = 8;

#[program]
pub mod solana_mq {
    use super::*;

    pub fn create_topic(ctx: Context<CreateTopic>, topic_name: String) -> Result<()> {
        let user_pubkey = ctx.accounts.user.key();
        msg!("Creating topic {} for user {}", topic_name, user_pubkey);

        ctx.accounts.topics.topics.push(topic_name);
        Ok(())
    }

    pub fn remove_topic(ctx: Context<RemoveTopic>, topic_name: String) -> Result<()> {
        let user_pubkey = ctx.accounts.user.key();
        msg!("Removing topic {} for user {}", topic_name, user_pubkey);

        let mut topics = ctx.accounts.topics.topics.clone();
        match topics.iter().position(|x| x == &topic_name) {
            Some(index) => {
                topics.remove(index);
                ctx.accounts.topics.topics = topics;
                Ok(())
            }
            None => {
                return Err(ErrorCode::TopicNotFound.into());
            }
        }
    }
}

#[account]
#[derive(InitSpace)]
pub struct Topics {
    #[max_len(64, 64)]
    pub topics: Vec<String>,
}

#[derive(Accounts)]
pub struct CreateTopic<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init,
        payer = user,
        space = ANCHOR_DESCRIMINATOR_SIZE + Topics::INIT_SPACE,
        seeds = [b"topics", user.key().as_ref()],
        bump
    )]
    pub topics: Account<'info, Topics>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RemoveTopic<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"topics", user.key().as_ref()],
        bump
    )]
    pub topics: Account<'info, Topics>,

    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum ErrorCode {
    TopicNotFound,
}