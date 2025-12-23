const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// OdaAdı -> [SocketID, SocketID...]
const rooms = {};

io.on('connection', (socket) => {
    console.log('Oyuncu bağlandı:', socket.id);

    socket.on('join_room', (roomId) => {
        // Odaya katıl
        socket.join(roomId);
        
        // Odadaki diğer kişileri bul
        const clients = io.sockets.adapter.rooms.get(roomId);
        const otherUsers = [];
        
        if (clients) {
            clients.forEach(clientId => {
                if (clientId !== socket.id) {
                    otherUsers.push(clientId);
                }
            });
        }

        // Katılan kişiye "Odada bunlar var, onlara bağlan" de
        socket.emit('all_users', otherUsers);
    });

    // WebRTC Sinyal İletişimi (Kişiden Kişiye)
    socket.on('offer', (data) => {
        io.to(data.target).emit('offer', {
            sdp: data.sdp,
            caller: socket.id
        });
    });

    socket.on('answer', (data) => {
        io.to(data.target).emit('answer', {
            sdp: data.sdp,
            responder: socket.id
        });
    });

    socket.on('ice_candidate', (data) => {
        io.to(data.target).emit('ice_candidate', {
            candidate: data.candidate,
            sender: socket.id
        });
    });

    socket.on('disconnect', () => {
        console.log('Oyuncu ayrıldı:', socket.id);
        // Odadakilere haber ver (Gerekirse UI güncellemesi için)
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Game Voice Server running on port ${PORT}`);
});
