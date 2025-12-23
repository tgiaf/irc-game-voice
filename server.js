const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

io.on('connection', (socket) => {
    // Bağlantı anında log (İsteğe bağlı açabilirsiniz)
    // console.log('Socket bağlandı:', socket.id);

    // ODAYA KATILMA
    socket.on('join_room', (data) => {
        // Data kontrolü (Eski/Yeni sürüm uyumu için)
        const roomId = data.roomId || data; 
        const nick = data.nick || "Misafir";

        socket.join(roomId);
        socket.nickname = nick; // Nicki sokete kaydet
        socket.currentRoom = roomId; // Odayı kaydet
        
        // --- LOG BURADA YAZDIRILIYOR ---
        console.log(`[KATILDI] ${nick} -> Oda: ${roomId} (ID: ${socket.id})`);

        // Odadaki diğer kişileri bul ve gönder
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

        socket.emit('all_users', otherUsers);
        socket.to(roomId).emit('user_joined', { id: socket.id, nick: nick });
    });

    // MİKROFON DURUMU (MUTE/UNMUTE)
    socket.on('mic_status', (data) => {
        const roomId = data.roomId;
        const isMuted = data.isMuted;
        const status = isMuted ? "KAPATTI (MUTE)" : "AÇTI (UNMUTE)";
        
        // --- LOG BURADA YAZDIRILIYOR ---
        console.log(`[MİKROFON] ${socket.nickname || 'Bilinmiyor'} -> ${status}`);
    });

    // MANUEL AYRILMA (Butona basınca)
    socket.on('leave_room', (data) => {
        const roomId = data.roomId;
        console.log(`[AYRILDI] ${socket.nickname || 'Bilinmiyor'} -> Oda: ${roomId}`);
        
        socket.leave(roomId);
        socket.to(roomId).emit('user_left', { id: socket.id });
        
        socket.nickname = null;
        socket.currentRoom = null;
    });

    // WebRTC Sinyalleri (Offer/Answer/Ice)
    socket.on('offer', (data) => {
        io.to(data.target).emit('offer', { sdp: data.sdp, caller: socket.id });
    });

    socket.on('answer', (data) => {
        io.to(data.target).emit('answer', { sdp: data.sdp, responder: socket.id });
    });

    socket.on('ice_candidate', (data) => {
        io.to(data.target).emit('ice_candidate', { candidate: data.candidate, sender: socket.id });
    });

    // BAĞLANTI KOPMASI (İnternet gidince veya uygulama kapanınca)
    socket.on('disconnecting', () => {
        // Socket'in olduğu odaları bul ve hepsine haber ver
        for (const room of socket.rooms) {
            if (room !== socket.id) {
                console.log(`[KOPTU] ${socket.nickname || 'Bilinmiyor'} -> Oda: ${room}`);
                socket.to(room).emit('user_left', { id: socket.id });
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Game Voice Server running on port ${PORT}`);
});
