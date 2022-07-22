const express = require('express')
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const app = express()
require('dotenv').config();
const port = process.env.PORT || 5000

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1bwbh.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
                return res.status(401).send({ message: 'unAuthorized' });
        }
        const token = authHeader.split(' ')[1];
        jwt.verify(token, process.env.SECRET_ACCESS_TOKEN, function (err, decoded) {
                if (err) {
                        return res.status(403).send({ message: 'Forbidden access' });
                }
                req.decoded = decoded;
                next();
        });

}

async function run() {
        try {
                await client.connect();
                const serviceCollection = client.db("doctors_portal").collection("services");
                const bookingCollection = client.db("doctors_portal").collection("bookings");
                const userCollection = client.db("doctors_portal").collection("user");

                app.get('/service', async (req, res) => {
                        const query = {};
                        const cursor = serviceCollection.find(query);
                        const services = await cursor.toArray();
                        res.send(services);
                });

                app.put('/user/:email', async (req, res) => {
                        const email = req.params.email;
                        const user = req.body;
                        const filter = { email: email };
                        const options = { upsert: true };
                        const updateDoc = {
                                $set: user,
                        };
                        const result = await userCollection.updateOne(filter, updateDoc, options);
                        const token = jwt.sign({ email: email }, process.env.SECRET_ACCESS_TOKEN, { expiresIn: '1h' })
                        res.send({ result, token });
                })

                app.get('/available', async (req, res) => {
                        const date = req.query.date;
                        //step 1 : get all services
                        const services = await serviceCollection.find().toArray();
                        //step 2 : get the booking of the day, output: [{}, {}, {}, {}, {}, {}]
                        const query = { date: date };
                        const bookings = await bookingCollection.find(query).toArray();
                        //step 3 : for each service 
                        services.forEach(service => {
                                //step 4 : find the booking service,  output: [{}, {}, {}, {}]
                                const serviceBookings = bookings.filter(book => book.treatment === service.name);
                                //step 5 : select slot for service booking: ['', '', '', '']
                                const bookedSlots = serviceBookings.map(book => book.slot);
                                //step 6 : select slots those are not in booked slots
                                const available = service.slots.filter(slot => !bookedSlots.includes(slot));
                                //step 7 : set available to make it easier
                                service.slots = available;
                        })
                });

                app.get('/booking', verifyJWT, async (req, res) => {
                        const patient = req.query.patient;
                        const decodedEmail = req.decoded.email;
                        if (patient === decodedEmail) {
                                const query = { patient: patient };
                                const bookings = await bookingCollection.find(query).toArray();
                                return res.send(bookings);
                        }
                        else {
                                return res.status(403).send({ message: 'Forbidden' })
                        }
                })

                app.post('/booking', async (req, res) => {
                        const booking = req.body;
                        const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
                        const exists = await bookingCollection.findOne(query);
                        if (exists) {
                                return res.send({ success: false, booking: exists })
                        }
                        const result = await bookingCollection.insertOne(booking);
                        return res.send({ success: true, result });
                });


        }
        finally {

        }
}
run().catch(console.dir);


app.get('/', (req, res) => {
        res.send('Hello doctors portal!')
})

app.listen(port, () => {
        console.log(`doctors portal listening on port ${port}`)
})