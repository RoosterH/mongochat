const MongoClient = require('mongodb').MongoClient;
// socket.io in conjunction with Express
// https://github.com/socketio/socket.io#in-conjunction-with-express
const app = require('express')();
const server = require('http').createServer(app);
const SocketClient = require('socket.io')(server);
server.listen(4000);

const Joi = require('@hapi/joi');
const assert = require('assert');

// Connection URL
const url = `mongodb://127.0.0.1:27017`;

// Database Name
const dbName = 'mongochat';

// 1. Connect to MongoDB server, server is located in /usr/local/bin/mongo
// https://stackoverflow.com/questions/47662220/db-collection-is-not-a-function-when-using-mongoclient-v3-0
MongoClient.connect(url, (err, client) => {
    if (err) {
        throw err;
    }
    console.log('MongoDB Connected successfully to server');
    // 2. connect to Socket.io
    SocketClient.on('connection', (socket) => {
        // set db name
        const db = client.db(dbName);
        const chat = db.collection('chats');

        // Get chats from mongo collection and emit the request to client
        chat.find().limit(100).sort({_id:1}).toArray((err, res)=> {
            if (err) {
                throw err;
            }

            // Emit the messages from server side, client will use socket.on('outpout', ()) to 
            // get the request
            socket.emit('output', res);
        });

        // Create function to send status
        sendStatus = (s) => {
            socket.emit('status', s);
        }

        function validateData(data) {
            const schema = Joi.object({
                name: Joi.string().required(),
                message: Joi.string().required()
            });
            return schema.validate(data);
        }

        // handle input events from client
        socket.on('input', (data) => {
            // use joi to define schema for data and validation
            // validateData(data) returns the following, we use { error } to take the error part
            // {
            //     value: { name: 'Hung', message: '' },
            //     error: [Error [ValidationError]: "message" is not allowed to be empty] {
            //         _original: { name: 'Hung', message: '' },
            //         details: [ [Object] ]
            //     }
            // }
            const { error } = validateData(data);
            const name = data.name;
            const message = data.message;

            // check for name and message
            if (error) {
                //console.log(error);
                // Send error status
                sendStatus('Please enter a name and a message');
            } else {
                // insert message into DB
                chat.insert({name: name, message: message}, () => {
                    SocketClient.emit('output', [data]);

                    // Send status object, clear is the flag to check wheather we need to clear message or not
                    sendStatus({
                        message: 'Message Sent',
                        clear: true
                    });
                });
            }
        });

        //Handle clear button
        socket.on('clear', (data) => {
            // Remove all chats from collection
            chat.remove({}, () => {
                // Emit cleared
                socket.emit('cleared');
            });
        });
    });
});