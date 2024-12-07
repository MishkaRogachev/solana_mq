use anchor_lang::prelude::*;

declare_id!("9tgFGPhuMsuXUUAWFNfuFEpBuANtjvwDdu9maFVFbLfo");

const ANCHOR_DESCRIMINATOR_SIZE: usize = 8;
const MAX_TOPICS: usize = 128;
const MAX_TOPIC_LENGTH: usize = 64;

#[program]
pub mod solana_mq {
    use super::*;

    pub fn initialise(ctx: Context<Initialise>) -> Result<()> {
        msg!("Initialising Topics account for user {}", ctx.accounts.user.key());
        Ok(())
    }

    pub fn deinitialise(ctx: Context<Deinitialise>) -> Result<()> {
        msg!("Closing Topics account for user {}", ctx.accounts.user.key());
        Ok(())
    }

    pub fn create_topic(ctx: Context<CreateTopic>, topic_name: String) -> Result<()> {
        let user_pubkey = ctx.accounts.user.key();
        msg!("Creating topic {} for user {}", topic_name, user_pubkey);

        if topic_name.len() > MAX_TOPIC_LENGTH {
            return Err(ErrorCode::TopicNameTooLong.into());
        }

        if ctx.accounts.topics.topics.len() >= MAX_TOPICS {
            return Err(ErrorCode::TopicLimitReached.into());
        }

        if ctx.accounts.topics.topics.contains(&topic_name) {
            return Err(ErrorCode::TopicAlreadyExists.into());
        }

        ctx.accounts.topics.topics.push(topic_name);
        Ok(())
    }

    pub fn remove_topic(ctx: Context<RemoveTopic>, topic_name: String) -> Result<()> {
        let user_pubkey = ctx.accounts.user.key();
        msg!("Removing topic {} for user {}", topic_name, user_pubkey);

        let topics = &mut ctx.accounts.topics.topics;
        if let Some(index) = topics.iter().position(|p| p == &topic_name) {
            topics.remove(index);
            Ok(())
        } else {
            Err(ErrorCode::TopicNotFound.into())
        }
    }
}

#[account]
#[derive(InitSpace)]
pub struct Topics {
    #[max_len(MAX_TOPICS, MAX_TOPIC_LENGTH)]
    pub topics: Vec<String>,
}

#[derive(Accounts)]
pub struct Initialise<'info> {
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
pub struct Deinitialise<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        close = user, // Transfer remaining lamports to the user
        seeds = [b"topics", user.key().as_ref()],
        bump
    )]
    pub topics: Account<'info, Topics>,
}

#[derive(Accounts)]
pub struct CreateTopic<'info> {
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"topics", user.key().as_ref()],
        bump
    )]
    pub topics: Account<'info, Topics>,
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
    TopicNameTooLong,
    TopicAlreadyExists,
    TopicLimitReached,
}