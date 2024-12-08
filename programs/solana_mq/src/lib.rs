use anchor_lang::prelude::*;

declare_id!("9tgFGPhuMsuXUUAWFNfuFEpBuANtjvwDdu9maFVFbLfo");

const ANCHOR_DESCRIMINATOR_SIZE: usize = 8;
const PUB_KEY_SIZE: usize = 32;
const TIMESTAMP_SIZE: usize = 8;

const HUB_SEED: &[u8] = b"hub";
const ACCESS_TOKEN_SEED: &[u8] = b"access_token";

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
        // Verify the provided access token
        let hub_key = ctx.accounts.hub.key();
        let (expected_access_token, _bump) = Pubkey::find_program_address(
            &[ACCESS_TOKEN_SEED, hub_key.as_ref()],
            &crate::ID,
        );

        require!(
            ctx.accounts.access_token.key() == expected_access_token,
            ErrorCode::Unauthorized
        );

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
        seeds = [HUB_SEED, rent_payer.key().as_ref()],
        bump
    )]
    pub hub: Account<'info, Hub>,

    /// CHECK: This PDA is derived and validated against the program
    #[account(seeds = [ACCESS_TOKEN_SEED, hub.key().as_ref()], bump)]
    pub access_token: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseHub<'info> {
    #[account(mut)]
    pub rent_payer: Signer<'info>,

    #[account(
        mut,
        close = rent_payer,
        seeds = [HUB_SEED, rent_payer.key().as_ref()],
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
        seeds = [HUB_SEED, hub.owner.as_ref()],
        bump
    )]
    pub hub: Account<'info, Hub>,

    /// CHECK: This PDA is derived and validated against the program
    #[account(seeds = [ACCESS_TOKEN_SEED, hub.key().as_ref()], bump)]
    pub access_token: AccountInfo<'info>,
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
}
