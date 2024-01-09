const express = require('express')
const cors = require('cors')
const Stripe = require("stripe");
const { db } = require('./firebase');
const app = express()

require('dotenv').config()

app.use((req, res, next) => {
    if (req.originalUrl === '/webhook') {
        next()
    } else {
        express.json()(req, res, next)
    }
});
app.use(cors())

// ignore undefined value or 
// db.settings({ ignoreUndefinedProperties: true })

// db.settings({ ignoreUndefinedProperties: true })

const stripe = Stripe(process.env.STRIPE_KEY)

const PORT = process.env.PORT || 5000

let data;
let paymentStatus;
let customerData;

app.post('/create-checkout-session', async (req, res) => {
    // let cartItem;
    const customerId = Math.floor(Math.random() * 1000)

    const cartItem = req.body.cartItem.map((item) => {
        return { id: item.id, quantity: item.quantity, totalPrice: item.totalPrice }
    })

    const customer = await stripe.customers.create({
        metadata: {
            customerId: customerId,
            userEmail: req.body.email,
            userUid: req.body.userUid,
            userId: req.body.userId,
            cart: JSON.stringify(cartItem),
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
        success_url: 'https://stripe-client-1.vercel.app/success',
        cancel_url: 'https://stripe-client-1.vercel.app/cancel',
    });

    res.send({ url: session.url, paymentStatus });
});

let endpointSecret;
// endpointSecret = process.env.WEBHOOK_SEC
endpointSecret = "whsec_3ZiPD4kB8OvOuX6gWfDDL6yPHHwtsDSA"
let eventType;

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    const sig = req.headers['stripe-signature'];

    if (endpointSecret) {
        let event;

        try {
            event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
            console.log('success')
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

// random id generate
//  console.log('customerId', customerId)

//  date and time stamp 
const today = new Date();
const timeZone = today.toLocaleString()

let inTotalAmount = 0;

const createOrder = async (customer, intent, res) => {
    console.log('customer', customer)
    console.log('intent', intent)
    if (intent.amount) {
        inTotalAmount = intent.amount
    }
    else {
        inTotalAmount = intent.amount_total
    }
    try {
        const orderDate = Date.now();
        const cartItem = {
            date: timeZone,
            cartItem: JSON.parse(customer.metadata.cart),
            email: customer.email,
            phone: customer.phone,
            amount: inTotalAmount,
            userId: customer.metadata.userUid,
            customerId: intent.created,
        }

        await db.collection('orders').add(cartItem)
        // console.log(cartItem)

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