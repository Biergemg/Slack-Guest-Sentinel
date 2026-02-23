import { config } from 'dotenv';
import Stripe from 'stripe';
import path from 'path';

// Load environment variables from .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey || secretKey === 'sk_test_placeholder') {
    console.error('❌ STRIPE_SECRET_KEY is missing or invalid in .env.local');
    console.error('Please configure your Stripe test keys before running this script.');
    process.exit(1);
}

const stripe = new Stripe(secretKey, {
    apiVersion: '2026-01-28.clover',
});

const productsToCreate = [
    {
        name: 'Slack Guest Sentinel Starter',
        description: 'Up to 500 total workspace members. Automated audits and DM alerts.',
        price: 2900, // $29.00
        lookup_key: 'starter_monthly',
    },
    {
        name: 'Slack Guest Sentinel Growth',
        description: 'Up to 5,000 total workspace members. Automated audits and multi-admin alerts.',
        price: 7900, // $79.00
        lookup_key: 'growth_monthly',
    },
    {
        name: 'Slack Guest Sentinel Scale',
        description: 'Unlimited workspace members. Full enterprise protection and reporting.',
        price: 19900, // $199.00
        lookup_key: 'scale_monthly',
    },
];

async function main() {
    console.log('🚀 Starting Stripe Product & Price initialization...\n');
    const priceEnvVars: string[] = [];

    for (const item of productsToCreate) {
        try {
            // 1. Create or retrieve Product
            let productResult = await stripe.products.search({
                query: `name:'${item.name}'`,
                limit: 1,
            });

            let product: Stripe.Product;

            if (productResult.data.length > 0) {
                product = productResult.data[0];
                console.log(`✅ Found existing product: ${product.name} (${product.id})`);
            } else {
                product = await stripe.products.create({
                    name: item.name,
                    description: item.description,
                });
                console.log(`✨ Created new product: ${product.name} (${product.id})`);
            }

            // 2. Create Price for the product
            // Let's check if the exact price already exists for this product
            const pricesResult = await stripe.prices.list({
                product: product.id,
                active: true,
            });

            let price = pricesResult.data.find(
                (p) => p.unit_amount === item.price && p.recurring?.interval === 'month'
            );

            if (price) {
                console.log(`✅ Found existing price: $${item.price / 100}/mo (${price.id})`);
            } else {
                price = await stripe.prices.create({
                    product: product.id,
                    unit_amount: item.price,
                    currency: 'usd',
                    recurring: { interval: 'month' },
                    lookup_key: item.lookup_key, // Optional, useful for finding it later
                });
                console.log(`✨ Created new price: $${item.price / 100}/mo (${price.id})`);
            }

            // 3. Store the env var string
            const envKeyName = `STRIPE_PRICE_${item.name.split(' ').pop()?.toUpperCase()}`;
            priceEnvVars.push(`${envKeyName}=${price.id}`);
            console.log('----------------------------------------------------');
        } catch (err) {
            console.error(`❌ Error processing ${item.name}:`, err);
        }
    }

    console.log('\n🎉 Done! Add these values to your .env.local and Vercel:\n');
    priceEnvVars.forEach((envVar) => {
        console.log(envVar);
    });
    console.log('\n');
}

main().catch(console.error);
