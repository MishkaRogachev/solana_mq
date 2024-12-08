use anchor_lang::prelude::*;

declare_id!("9tgFGPhuMsuXUUAWFNfuFEpBuANtjvwDdu9maFVFbLfo");

const MAX_SUBSCRIBERS: usize = 64;

#[program]
pub mod solana_mq {
    use super::*;

    pub fn create_hub(ctx: Context<CreateHub>) -> Result<()> {
        let hub = &mut ctx.accounts.hub;
        hub.owner = ctx.accounts.rent_payer.key();
        hub.created_at = Clock::get()?.unix_timestamp;
        hub.subscribers = Vec::new();

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

    pub fn subscribe(ctx: Context<Subscribe>, topic: String) -> Result<()> {
        require!(topic.len() <= 64, ErrorCode::TopicNameTooLong);

        let hub = &mut ctx.accounts.hub;
        let subscriber = ctx.accounts.subscriber.key();

        if hub
            .subscribers
            .iter()
            .any(|(sub, sub_topic)| sub == &subscriber && sub_topic == &topic)
        {
            msg!("{} is already subscribed to topic '{}'", subscriber, topic);
            return Ok(());
        }

        hub.subscribers.push((subscriber, topic.clone()));

        msg!(
            "{} subscribed to topic '{}' in hub {}",
            subscriber,
            topic,
            ctx.accounts.hub.key()
        );

        Ok(())
    }

    pub fn publish(ctx: Context<Publish>, topic: String, message: String) -> Result<()> {
        require!(topic.len() <= 64, ErrorCode::TopicNameTooLong);
        require!(message.len() <= 256, ErrorCode::MessageTooLong);

        let hub = &ctx.accounts.hub;

        for (subscriber, subscribed_topic) in &hub.subscribers {
            if topic.starts_with(subscribed_topic) {
                emit!(Publication {
                    hub: ctx.accounts.hub.key(),
                    publisher: ctx.accounts.publisher.key(),
                    subscriber: *subscriber,
                    topic: topic.clone(),
                    message: message.clone(),
                });
            }
        }

        Ok(())
    }
}

#[account]
pub struct Hub {
    pub owner: Pubkey,                       // Owner of the hub
    pub created_at: i64,                     // Timestamp when the hub was created
    pub subscribers: Vec<(Pubkey, String)>,  // List of (subscriber, topic)
}

#[derive(Accounts)]
pub struct CreateHub<'info> {
    #[account(mut)]
    pub rent_payer: Signer<'info>,

    #[account(
        init,
        payer = rent_payer,
        space = 8 + 32 + 8 + 4 + 32 * MAX_SUBSCRIBERS,
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
pub struct Subscribe<'info> {
    #[account(mut)]
    pub subscriber: Signer<'info>,

    #[account(
        mut,
        seeds = [b"hub", hub.owner.as_ref()],
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
    pub subscriber: Pubkey,
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
