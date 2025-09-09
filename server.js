const httpServer = require("http").createServer();

const hostname = "192.168.100.100";
const PORT = process.env.PORT || 3000;
const clientPort = 4200;

const io = require("socket.io")(httpServer, {
  cors: {
    origin: `http://${hostname}:${clientPort}`,
  },
});

const users = new Map();

io.use((socket, next) => {
  const userId  = socket.handshake.auth.userId;

  if (!userId) {
    return next(new Error("Invalid userId"));
  }

  socket.userId = userId;

  next();
});

io.on('connection', (socket) => {
  const userId = socket.userId;
  if (!users.has(userId)) {
    users.set(userId, new Set());
  }
  users.get(userId).add(socket.id);

  console.log(users);

  socket.broadcast.emit("user connected", {
    userId: socket.userId,
    connected: true,
  });

  socket.on('message', ({ recipientId, message }) => {
    const sockets = users.get(recipientId);
    sockets?.forEach(socketId => {
      io.to(socketId).emit('message', {
        recipientId,
        message
      });
    })
  });

  socket.on('read messages', ({ userId, reader }) => {
    const sockets = users.get(userId);
    sockets?.forEach((socketId) => {
      io.to(socketId).emit('read messages', {
        userId,
        reader,
      });
    });
  });

  socket.on('delete messages', ({ userId, chatId, messageIds }) => {
    const recipientSockets = users.get(userId);
    if (recipientSockets) {
      recipientSockets.forEach((socketId) => {
        io.to(socketId).emit('delete messages', {
          chatId,
          messageIds,
        });
      });
    }
  });

  socket.on('create chat', ({ userId: targetUserId, chat }) => {
    const recipientSockets = users.get(targetUserId);
    if (recipientSockets) {
      recipientSockets.forEach((socketId) => {
        io.to(socketId).emit('create chat', {
          from: targetUserId,
          chat
        });
      });
    }
  });

  socket.on('edit chat', ({ userId: targetUserId, chat }) => {
    const recipientSockets = users.get(targetUserId);
    if (recipientSockets) {
      recipientSockets.forEach((socketId) => {
        io.to(socketId).emit('edit chat', {
          from: targetUserId,
          chat
        });
      });
    }
  });


  socket.on('leave chat', ({ participantId, logs, chat }) => {
    const recipientSockets = users.get(participantId);
    if (recipientSockets) {
      recipientSockets.forEach((socketId) => {
        io.to(socketId).emit('leave chat', {
          from: participantId,
          logs,
          chat
        });
      });
    }
  });

  socket.on('drop chat', ({ participantId, chat }) => {
    const recipientSockets = users.get(participantId);
    if (recipientSockets) {
      recipientSockets.forEach((socketId) => {
        io.to(socketId).emit('drop chat', {
          from: participantId,
          chat
        });
      });
    }
  });

  socket.on('disconnect', () => {
    const userSockets = users.get(socket.userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        users.delete(socket.userId);
      }
    }
  });
});


httpServer.listen(PORT, hostname, () => {
  console.log(`Server listening at http://${hostname}:${PORT}`);
});