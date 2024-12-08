use anchor_lang::prelude::*;

declare_id!("9tgFGPhuMsuXUUAWFNfuFEpBuANtjvwDdu9maFVFbLfo");

const ANCHOR_DESCRIMINATOR_SIZE: usize = 8;
const PUB_KEY_SIZE: usize = 32;
const TIMESTAMP_SIZE: usize = 8;

#[program]
pub mod solana_mq {
    use super::*;

    pub fn create_hub(ctx: Context<CreateHub>) -> Result<()> {
        let hub = &mut ctx.accounts.hub;
        hub.owner = ctx.accounts.rent_payer.key();
        hub.created_at = Clock::get()?.unix_timestamp;

        msg!("Hub created by {}", hub.owner);
        Ok(())
    }

    pub fn close_hub(ctx: Context<CloseHub>) -> Result<()> {
        require!(
            ctx.accounts.hub.owner == ctx.accounts.rent_payer.key(),
            ErrorCode::Unauthorized
        );

        msg!("Hub closed by {}", ctx.accounts.rent_payer.key());
        Ok(())
    }

    pub fn publish(ctx: Context<Publish>, topic: String, message: String) -> Result<()> {
        emit!(Publication {
            hub: ctx.accounts.hub.key(),
            publisher: ctx.accounts.publisher.key(),
            topic: topic.clone(),
            message: message.clone(),
        });

        Ok(())
    }
}

#[account]
pub struct Hub {
    pub owner: Pubkey,                       // Owner of the hub, 32 bytes
    pub created_at: i64,                     // Timestamp when the hub was created, 8 bytes
}

#[derive(Accounts)]
pub struct CreateHub<'info> {
    #[account(mut)]
    pub rent_payer: Signer<'info>,

    #[account(
        init,
        payer = rent_payer,
        space = ANCHOR_DESCRIMINATOR_SIZE + PUB_KEY_SIZE + TIMESTAMP_SIZE,
        seeds = [b"hub", rent_payer.key().as_ref()],
        bump
    )]
    pub hub: Account<'info, Hub>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseHub<'info> {
    #[account(mut)]
    pub rent_payer: Signer<'info>,

    #[account(
        mut,
        close = rent_payer,
        seeds = [b"hub", rent_payer.key().as_ref()],
        bump
    )]
    pub hub: Account<'info, Hub>,
}

#[derive(Accounts)]
pub struct Publish<'info> {
    #[account(mut)]
    pub publisher: Signer<'info>,

    #[account(
        mut,
        seeds = [b"hub", hub.owner.as_ref()],
        bump
    )]
    pub hub: Account<'info, Hub>,
}

#[event]
pub struct Publication {
    pub hub: Pubkey,
    pub publisher: Pubkey,
    pub topic: String,
    pub message: String,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized action.")]
    Unauthorized,
    #[msg("Topic name too long.")]
    TopicNameTooLong,
    #[msg("Message too long.")]
    MessageTooLong,
}
