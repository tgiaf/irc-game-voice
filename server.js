const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

io.on('connection', (socket) => {
    // Varsayılan durumlar
    socket.isMuted = false; 

    // ODAYA KATILMA
    socket.on('join_room', (data) => {
        const roomId = data.roomId || data; 
        const nick = data.nick || "Misafir";

        socket.join(roomId);
        socket.nickname = nick;
        socket.currentRoom = roomId;
        
        console.log(`[KATILDI] ${nick} -> Oda: ${roomId} (ID: ${socket.id})`);

        // Odadaki diğer kişileri bul
        const clients = io.sockets.adapter.rooms.get(roomId);
        const otherUsers = [];
        
        if (clients) {
            clients.forEach(clientId => {
                if (clientId !== socket.id) {
                    const clientSocket = io.sockets.sockets.get(clientId);
                    otherUsers.push({ 
                        id: clientId, 
                        nick: clientSocket ? clientSocket.nickname : "Bilinmiyor",
                        isMuted: clientSocket ? clientSocket.isMuted : false // Mute durumunu da gönder
                    });
                }
            });
        }

        // Katılan kişiye listeyi gönder
        socket.emit('all_users', otherUsers);
        
        // Odadakilere yeni kişiyi bildir (Varsayılan mute: false)
        socket.to(roomId).emit('user_joined', { 
            id: socket.id, 
            nick: nick,
            isMuted: false 
        });
    });

    // MİKROFON DURUMU (GÜNCELLENDİ)
    socket.on('mic_status', (data) => {
        const roomId = data.roomId;
        const isMuted = data.isMuted;
        
        // Sunucu hafızasına kaydet (Yeni gelenler bilsin diye)
        socket.isMuted = isMuted;

        const status = isMuted ? "KAPATTI (MUTE)" : "AÇTI (UNMUTE)";
        console.log(`[MİKROFON] ${socket.nickname || 'Bilinmiyor'} -> ${status}`);
        
        // ODADAKİ HERKESE BİLDİR
        socket.to(roomId).emit('user_mic_change', { 
            id: socket.id, 
            isMuted: isMuted 
        });
    });

    // MANUEL AYRILMA
    socket.on('leave_room', (data) => {
        const roomId = data.roomId;
        console.log(`[AYRILDI] ${socket.nickname || 'Bilinmiyor'} -> Oda: ${roomId}`);
        socket.leave(roomId);
        socket.to(roomId).emit('user_left', { id: socket.id });
        socket.nickname = null;
        socket.currentRoom = null;
        socket.isMuted = false;
    });

    // WebRTC Sinyalleri
    socket.on('offer', (data) => {
        io.to(data.target).emit('offer', { sdp: data.sdp, caller: socket.id });
    });

    socket.on('answer', (data) => {
        io.to(data.target).emit('answer', { sdp: data.sdp, responder: socket.id });
    });

    socket.on('ice_candidate', (data) => {
        io.to(data.target).emit('ice_candidate', { candidate: data.candidate, sender: socket.id });
    });

    // KOPMA
    socket.on('disconnecting', () => {
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
