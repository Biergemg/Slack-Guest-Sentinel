require('dotenv').config({ path: '.env.local' });
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
});

async function testCheck() {
    console.log("Testing Stripe Prices...");
    try {
        const p1 = await stripe.prices.retrieve(process.env.STRIPE_PRICE_STARTER);
        console.log("Starter Price OK:", p1.id);
        const p2 = await stripe.prices.retrieve(process.env.STRIPE_PRICE_GROWTH);
        console.log("Growth Price OK:", p2.id);
        const p3 = await stripe.prices.retrieve(process.env.STRIPE_PRICE_SCALE);
        console.log("Scale Price OK:", p3.id);
    } catch (error) {
        console.error("❌ STRIPE ERROR DETAILS:");
        console.error(error.message);
    }
}

testCheck();
