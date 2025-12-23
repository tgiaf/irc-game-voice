const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

io.on('connection', (socket) => {
    console.log('Bağlantı:', socket.id);

    // GÜNCELLENDİ: Artık nick bilgisini de alıyoruz
    socket.on('join_room', ({ roomId, nick }) => {
        socket.join(roomId);
        socket.nickname = nick; // Nicki sokete kaydet
        
        // Odadaki diğer kişileri bul
        const clients = io.sockets.adapter.rooms.get(roomId);
        const otherUsers = [];
        
        if (clients) {
            clients.forEach(clientId => {
                if (clientId !== socket.id) {
                    const clientSocket = io.sockets.sockets.get(clientId);
                    otherUsers.push({ 
                        id: clientId, 
                        nick: clientSocket ? clientSocket.nickname : "Bilinmiyor" 
                    });
                }
            });
        }

        // 1. Katılan kişiye odadakilerin listesini gönder
        socket.emit('all_users', otherUsers);

        // 2. Odadakilere "Yeni biri geldi" de (Nick ile)
        socket.to(roomId).emit('user_joined', { id: socket.id, nick: nick });
    });

    // WebRTC Sinyalleri (Değişmedi)
    socket.on('offer', (data) => {
        io.to(data.target).emit('offer', { sdp: data.sdp, caller: socket.id });
    });

    socket.on('answer', (data) => {
        io.to(data.target).emit('answer', { sdp: data.sdp, responder: socket.id });
    });

    socket.on('ice_candidate', (data) => {
        io.to(data.target).emit('ice_candidate', { candidate: data.candidate, sender: socket.id });
    });

    // Ayrılma Durumu
    socket.on('disconnecting', () => {
        // Hangi odalardaysa oradakilere haber ver
        for (const room of socket.rooms) {
            socket.to(room).emit('user_left', { id: socket.id });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Game Voice Server running on port ${PORT}`);
});
