use anchor_lang::prelude::*;

declare_id!("9tgFGPhuMsuXUUAWFNfuFEpBuANtjvwDdu9maFVFbLfo");

const ANCHOR_DESCRIMINATOR_SIZE: usize = 8;
const MAX_SUBSCRIPTIONS: usize = 256;

#[program]
pub mod solana_mq {
    use super::*;

    pub fn initialise(ctx: Context<Initialise>) -> Result<()> {
        msg!("Initializing publisher account for {}", ctx.accounts.user.key());

        let subscriptions = &mut ctx.accounts.subscriptions;
        subscriptions.owner = ctx.accounts.user.key();
        subscriptions.subscribers = Vec::new();

        Ok(())
    }

    pub fn deinitialise(ctx: Context<Deinitialise>) -> Result<()> {
        msg!("Closing publisher account for {}", ctx.accounts.user.key());
        Ok(())
    }

    pub fn subscribe(ctx: Context<Subscribe>, topic_name: String) -> Result<()> {
        let publisher_subscriptions = &mut ctx.accounts.subscriptions;

        msg!(
            "{} subscribing to topic '{}' of {}",
            ctx.accounts.subscriber.key(),
            topic_name,
            publisher_subscriptions.owner
        );

        // Validate that the topic exists
        if !publisher_subscriptions
            .subscribers
            .iter()
            .any(|(_, topic)| topic == &topic_name)
        {
            publisher_subscriptions
                .subscribers
                .push((ctx.accounts.subscriber.key(), topic_name.clone()));
            Ok(())
        } else {
            Err(ErrorCode::TopicAlreadySubscribed.into())
        }
    }

    pub fn publish(ctx: Context<Publish>, topic: String, message: String) -> Result<()> {
        let publisher = ctx.accounts.publisher.key();
        let subscriptions = &ctx.accounts.subscriptions.subscribers;

        msg!("{} publishing '{}' to topic '{}'", publisher, message, topic);

        for (subscriber, subscribed_topic) in subscriptions.iter() {
            if subscribed_topic == &topic {
                emit!(Publication {
                    publisher,
                    topic: topic.clone(),
                    message: message.clone(),
                    subscriber: *subscriber,
                });
            }
        }

        Ok(())
    }

}

#[account]
pub struct Subscriptions {
    pub owner: Pubkey,
    pub subscribers: Vec<(Pubkey, String)>
}

#[event]
pub struct Publication {
    pub publisher: Pubkey,
    pub topic: String,
    pub message: String,
    pub subscriber: Pubkey,
}

#[derive(Accounts)]
pub struct Initialise<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init,
        payer = user,
        space = ANCHOR_DESCRIMINATOR_SIZE + 32 + (4 + 32 * MAX_SUBSCRIPTIONS), // Space for subscription map
        seeds = [b"subscriptions", user.key().as_ref()],
        bump
    )]
    pub subscriptions: Account<'info, Subscriptions>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deinitialise<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        close = user, // Refund remaining lamports to the user
        seeds = [b"subscriptions", user.key().as_ref()],
        bump
    )]
    pub subscriptions: Account<'info, Subscriptions>,
}

#[derive(Accounts)]
pub struct Subscribe<'info> {
    #[account(mut)]
    pub subscriber: Signer<'info>,

    #[account(
        mut,
        seeds = [b"subscriptions", publisher.key().as_ref()],
        bump
    )]
    pub subscriptions: Account<'info, Subscriptions>,

    /// CHECK: The publisher account is not read or written to; it is used purely to derive the PDA for subscriptions.
    pub publisher: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct Publish<'info> {
    #[account(mut)]
    pub publisher: Signer<'info>,

    #[account(
        mut,
        seeds = [b"subscriptions", publisher.key().as_ref()],
        bump
    )]
    pub subscriptions: Account<'info, Subscriptions>,
}

#[error_code]
pub enum ErrorCode {
    SubscriptionLimitReached,
    TopicAlreadySubscribed,
}
