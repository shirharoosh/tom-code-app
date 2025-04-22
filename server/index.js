const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const CodeBlock = require('./modules/CodeBlock');


const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());


// Mongo DB connection
mongoose.connect(
    "mongodb+srv://tom-js-instructor:Tom123@cluster0.c0p515r.mongodb.net/tom_code_platform?retryWrites=true&w=majority&appName=Cluster0", 
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

const mentors = {};
const roomMembers = {};

io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    // 👉 Join a specific room
    socket.on("join-room", async (roomId) => {
        socket.join(roomId);

        if (!roomMembers[roomId]) {
            roomMembers[roomId] = new Set();
        }

        roomMembers[roomId].add(socket.id);

        const clients = await io.in(roomId).fetchSockets();
        const isMentor = clients.length === 1; // 👈 Only 1 = this is the first socket
        
        if (isMentor) {
            mentors[roomId] = socket.id;
        }

        const assignedRole = isMentor ? "mentor" : "student";
        console.log(`🎭 ${assignedRole} joined room ${roomId}: ${socket.id}`);
        socket.emit("role-assigned", assignedRole);

        const studentCount = clients.filter(c => c.id !== mentors[roomId]).length;
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
        if (roomMembers[roomId]) {
            roomMembers[roomId].delete(socket.id);
      
            const studentCount = [...roomMembers[roomId]].filter(id => id !== mentors[roomId]).length;
            io.to(roomId).emit("student-count", studentCount);
            console.log(`👋 ${socket.id} left room ${roomId}`);
        }
    });
      

    // 👉 Handle disconnect
    socket.on("disconnect", async () => {
        console.log("🔴 Disconnected:", socket.id);
      
        for (const roomId in roomMembers) {
            if (!roomMembers[roomId]) continue;

            // Remove the socket from the room
            roomMembers[roomId].delete(socket.id);

            const stillInRoom = [...roomMembers[roomId]];
            const studentCount = stillInRoom.filter(id => id !== mentors[roomId]).length;

            // 📡 Broadcast updated student count
            io.to(roomId).emit("student-count", studentCount);
            console.log(`🔁 Updated student count for ${roomId}: ${studentCount}`);

            // 🔥 If mentor left
            if (mentors[roomId] === socket.id) {
                console.log(`👋 Mentor left room ${roomId}`);
                try {
                    const block = await CodeBlock.findById(roomId);
                    if (block) {
                        io.to(roomId).emit("reset-code", block.template);
                        console.log("🔁 Code reset for students");
                    }
                } catch (err) {
                    console.error("❌ Could not fetch block:", err);
                }

                // 📢 Notify students BEFORE cleaning up
                io.to(roomId).emit("mentor-left");
                console.log(`📢 mentor-left emitted to room ${roomId}`);

                // Cleanup after short delay
                setTimeout(() => {
                    delete mentors[roomId];
                    delete roomMembers[roomId];
                    console.log(`🧹 Room ${roomId} fully cleaned`);
                }, 500);
            }

            // 🧼 If room is now completely empty (no mentor or students)
            if (stillInRoom.length === 0) {
                delete roomMembers[roomId];
                delete mentors[roomId];
                console.log(`🧼 Room ${roomId} is empty. Cleaned up.`);
            }
        }
    });      
});


// 🚀 Start the server
const PORT = 4000;
server.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
