const express = require('express')
const cors = require('cors')
const Stripe = require("stripe");
const app = express()
const path = require('path')
require('dotenv').config()

app.use(express.json())
app.use(cors())

const stripe = Stripe(process.env.STRIPE_KEY)

const PORT = process.env.PORT || 5000


// static file 
// app.use(express.static(path.join(__dirname, '../client/build')))
// app.get('*', function(req, res) {
//     res.sendFile(path.join(__dirname, '../client/build/index.html'))
// });

app.post('/create-checkout-session', async (req, res) => {
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
        line_items,
        mode: 'payment',
        success_url: 'http://localhost:3000/success',
        cancel_url: 'http://localhost:3000/cancel',
    });

    res.send({url: session.url});
});


app.get('/', (req, res) => {
    res.send('Wellcome from API')
})

app.listen(PORT, () => {
    console.log('App is running at 5000')
})