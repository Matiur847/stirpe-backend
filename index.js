const express = require('express')
const cors = require('cors')
const Stripe = require("stripe");
const app = express()
const admin = require('firebase-admin')
const credentials = require('./key.json')
require('dotenv').config()

app.use((req, res, next) => {
    if (req.originalUrl === '/webhook') {
        next()
    } else {
        express.json()(req, res, next)
    }
});
app.use(cors())

const stripe = Stripe(process.env.STRIPE_KEY)

const PORT = process.env.PORT || 5000


// firstore configure

admin.initializeApp({
    credential: admin.credential.cert(credentials)
})

const db = admin.firestore()

let data;
let paymentStatus;
let customerData;

app.post('/create-checkout-session', async (req, res) => {

    const customer = await stripe.customers.create({
        metadata: {
            userEmail: req.body.email,
            userUid: req.body.userUid,
            userId: req.body.userId,
            cart: JSON.stringify(req.body.cartItem)
        },
    });

    const line_items = req.body.cartItem.map(item => {
        return {
            price_data: {
                currency: 'usd',
                product_data: {
                    name: item.title,
                    images: [item.img],
                    metadata: {
                        id: item.id
                    }
                },
                unit_amount: item.price * 100
            },
            quantity: item.quantity,
        };
    })
    const session = await stripe.checkout.sessions.create({
        shipping_address_collection: {
            allowed_countries: ['US', 'CA', 'BD', 'IN'],
        },
        shipping_options: [
            {
                shipping_rate_data: {
                    type: 'fixed_amount',
                    fixed_amount: {
                        amount: 0,
                        currency: 'usd',
                    },
                    display_name: 'Free shipping',
                    delivery_estimate: {
                        minimum: {
                            unit: 'business_day',
                            value: 5,
                        },
                        maximum: {
                            unit: 'business_day',
                            value: 7,
                        },
                    },
                },
            },
            {
                shipping_rate_data: {
                    type: 'fixed_amount',
                    fixed_amount: {
                        amount: 1500,
                        currency: 'usd',
                    },
                    display_name: 'Next day air',
                    delivery_estimate: {
                        minimum: {
                            unit: 'business_day',
                            value: 1,
                        },
                        maximum: {
                            unit: 'business_day',
                            value: 1,
                        },
                    },
                },
            },
        ],
        phone_number_collection: {
            enabled: true
        },
        customer: customer.id,
        line_items,
        mode: 'payment',
        success_url: 'http://localhost:3000/success',
        cancel_url: 'http://localhost:3000/cancel',
    });

    res.send({ url: session.url, paymentStatus });
});

let endpointSecret;
endpointSecret = "whsec_646470e8d1077e62f54cbd9f33b2a15f20e8d6feed19da36792a30e38c4bf605";
let eventType;

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    const sig = req.headers['stripe-signature'];

    if (endpointSecret) {
        let event;

        try {
            event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        } catch (err) {
            console.log(`Webhook Error: ${err.message}`)
            res.status(400).send(`Webhook Error: ${err.message}`);
            return;
        }

        data = event.data.object
        eventType = event.type

    } else {
        data = req.body.data.object
        eventType = req.body.type
    }

    if (eventType === 'checkout.session.completed') {
        stripe.customers.retrieve(data.customer).then((customer) => {
            paymentStatus = data.status
            customerData = customer
            createOrder(customer, data, res)
        })
            .catch((error) => console.log(error.message))
    }

    res.send('Hello');
});

const createOrder = async (customer, intent, res) => {
    try {
        const orderDate = Date.now();
        const cartItem = {
            cartItem: JSON.parse(customer.metadata.cart),
            email: customer.metadata.userEmail,
            userId: customer.metadata.userUid,
        }

        await db.collection('orders').add(cartItem)

    } catch (err) {
        console.log(err)
    }
};


app.get('/', async (req, res) => {
    res.send('Stripe Backend Server')
})

app.listen(PORT, () => {
    console.log('App is running at 5000')
})