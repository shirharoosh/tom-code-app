require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const CodeBlock = require('./modules/CodeBlock');
const roomUsers = {}; // 🔁 roomId: [socketIds]
const mentors = {};   // roomId: mentorSocketId


const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());


// Mongo DB connection
mongoose.connect(
    process.env.MONGODB_URI, 
    { useNewUrlParser: true, useUnifiedTopology: true }
)
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ MongoDB error:", err));


// Test route
app.get("/", (req, res) => {
    res.send("Server is up!");
});


// ✅ Route: GET all code blocks (used by Lobby page)
app.get("/codeblocks", async (req, res) => {
    try {
      const blocks = await CodeBlock.find();
      res.json(blocks);
    } catch (err) {
      console.error("Error fetching blocks:", err);
      res.status(500).json({ error: "Failed to fetch code blocks" });
    }
  });


// ✅ Route: GET single block by ID (used by /code/:id)
app.get("/codeblocks/:id", async (req, res) => {
  try {
    const block = await CodeBlock.findById(req.params.id);
    if (!block) {
      return res.status(404).json({ error: "Code block not found" });
    }
    res.json(block);
  } catch (err) {
    console.error("Error getting code block:", err);
    res.status(500).json({ error: "Could not fetch code block" });
  }
});


// 🧠 Socket.IO real-time connection placeholder
const io = new Server(server, {
    cors: {
        origin: "*",
    },
});


// Handle connection
io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    // 👉 Join a specific room
    socket.on("join-room", async (roomId) => {
        socket.join(roomId);

        if (!roomUsers[roomId]) {
            roomUsers[roomId] = [];
        }

        roomUsers[roomId].push(socket.id);

        const isMentor = roomUsers[roomId].length === 1;
        if (isMentor) {
            mentors[roomId] = socket.id; // ✅ mark mentor
        }
        
        const assignedRole = isMentor ? "mentor" : "student";
        console.log(`🎭 Assigned ${assignedRole} in room ${roomId}`);

        socket.emit("role-assigned", assignedRole);

        const studentCount = roomUsers[roomId] ? roomUsers[roomId].length - 1 : 0;
        io.to(roomId).emit("student-count", studentCount);
    });

    
    // Handle Code update
    socket.on("code-update", ({ roomId, code }) => {
        // Send to everyone in the room EXCEPT the one who sent it
        socket.to(roomId).emit("receive-code", code);
    });        


    // 👉 Leave room
    socket.on("leave-room", async (roomId) => {
        socket.leave(roomId);
        roomUsers[roomId] = roomUsers[roomId]?.filter((id) => id !== socket.id);

        if (roomUsers[roomId]) {
            const studentCount = roomUsers[roomId] ? roomUsers[roomId].length - 1 : 0;
            io.to(roomId).emit("student-count", studentCount);
        }
        console.log(`👋 ${socket.id} left room ${roomId}`);
    });
      

    // 👉 Handle disconnect
    socket.on("disconnect", async () => {
        console.log("🔴 Disconnected:", socket.id);
        
        // Clean up all rooms this socket was in
        for (const roomId in roomUsers) {
            // Remove the user from the room list
            roomUsers[roomId] = roomUsers[roomId].filter((id) => id !== socket.id);

            // If mentor disconnected
            if (mentors[roomId] === socket.id) {
                console.log(`👋 Mentor left room ${roomId}. Kicking students.`);

                // Notify all students in the room
                io.to(roomId).emit("mentor-left");

                // Clean up
                delete mentors[roomId];
                delete roomUsers[roomId];
                continue;
            }

            // 🧹 If the room is now empty
            if (roomUsers[roomId]?.length === 0) {
                delete roomUsers[roomId];
                delete mentors[roomId];
                console.log(`🧹 Room ${roomId} is empty. Cleaned up.`);
            } else {
                // Broadcast updated student count
                const studentCount = roomUsers[roomId].length - 1;
                io.to(roomId).emit("student-count", studentCount);
            }
        }
    });      
});


// 🚀 Start the server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
