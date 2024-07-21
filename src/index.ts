import { v4 as uuidv4 } from 'uuid';
import { Server, StableBTreeMap, ic } from 'azle';
import express from 'express';

// Class to represent a User
class User {
    id: string;                                                                           
    username: string;                                                                     
    password: string;                                                                     
    mail: string;                                                                         
    role: string;                                                                         
    createdAt: Date;                                                                      

    // Constructor to initialize a User object
    constructor(id: string, username: string, password: string, mail: string, role: string, createdAt: Date) {
        this.id = id;
        this.username = username;
        this.password = password;
        this.mail = mail;
        this.role = role;
        this.createdAt = createdAt;
    }
}

// Class to represent a Task
class Task {
    taskid: string;                                                                         
    department: string;                                                                     
    title: string;                                                                          
    description: string;                                                                    

    // Constructor to initialize a Task object
    constructor(taskid: string, department: string, title: string, description: string) {
        this.taskid = taskid;
        this.department = department;
        this.title = title;
        this.description = description;
    }
}

// Class to represent a Volunteer
class Volunteer {
    volunteer_id: string;                                                                   
    name: string;                                                                           
    address: string;                                                                        
    phone_number: number;                                                                   
    centre: string;                                                                         
    tasks: Task[];                                                                          
    department: string;                                                                     
    role: string;                                                                           
    createdAt: Date;                                                                        

    // Constructor to initialize a Volunteer object
    constructor(volunteer_id: string, name: string, address: string, phone_number: number, centre: string, department: string, role: string, createdAt: Date) {
        this.volunteer_id = volunteer_id;
        this.name = name;
        this.address = address;
        this.phone_number = phone_number;
        this.centre = centre;
        this.department = department;
        this.tasks = [];  // Initialize an empty list of tasks
        this.role = role;
        this.createdAt = createdAt;
    }
}

// Storage initialization using StableBTreeMap
const VolunteerStorage = new StableBTreeMap<string, Volunteer>(0);
const UserStorage = new StableBTreeMap<string, User>(1);
const LoggedInUsers = new StableBTreeMap<string, User>(2);

const app = express();
app.use(express.json());

app.post("/signup/user", (req, res) => {
    const { username, password, mail } = req.body;
    
    if (!username || !password || !mail) {
        return res.status(400).json({ msg: "Please provide all required fields" });
    }
    
    const newUser = new User(uuidv4(), username, password, mail, "not assigned", getCurrentDate());
    UserStorage.insert(newUser.id, newUser);
    res.status(201).json({ msg: "User signed up successfully!" });
});

app.post("/login/user", (req, res) => {
    const { mail, password } = req.body;

    if (!mail || !password) {
        return res.status(400).json({ msg: "Please provide all required fields" });
    }

    const user = UserStorage.values().filter(user => user.mail === mail)[0];

    if (!user) {
        return res.status(401).json({ msg: "User does not exist. Please sign up." });
    }

    if (user.password !== password) {
        return res.status(400).json({ msg: "Invalid username or password" });
    }

    LoggedInUsers.insert(user.id, user);
    res.status(200).json({ msg: "User login successful", userdetails: user });
});

app.post("/logout/:userId", (req, res) => {
    const { userId } = req.params;
    const logout_User = LoggedInUsers.remove(userId);

    if (logout_User) {
        res.status(200).json({ message: "User logged out successfully" });
    } else {
        res.status(401).json({ message: "User not logged in" });
    }
});

app.post("/assign/role/:loginid", (req, res) => {
    const login_id = req.params.loginid;
    const loggedUserOpt = LoggedInUsers.get(login_id);

    if (!loggedUserOpt) {
        return res.status(403).json({ msg: "User not logged in!" });
    }

    const loggedUser = loggedUserOpt;
    const { role } = req.body;

    if (!role) {
        return res.status(400).json({ msg: "Please provide a role" });
    }

    loggedUser.role = role;
    LoggedInUsers.insert(loggedUser.id, loggedUser);
    res.status(201).json({ msg: "Role assigned", info: loggedUser });
});

app.post("/form/volunteer/:loginid", (req, res) => {
    const loginid = req.params.loginid;
    const loggedUserOpt = LoggedInUsers.get(loginid);

    if (!loggedUserOpt) {
        return res.status(403).json({ msg: "User not logged in!" });
    }

    const loggedUser = loggedUserOpt;
    const { name, address, phone_number, centre, department } = req.body;

    if (!name || !address || !phone_number || !centre || !department) {
        return res.status(400).json({ msg: "Please provide all required fields" });
    }

    const role = loggedUser.role === "admin" ? "admin and volunteer" : "volunteer";
    const newVolunteer = new Volunteer(loggedUser.id, name, address, phone_number, centre, department, role, getCurrentDate());

    loggedUser.role = role;
    VolunteerStorage.insert(newVolunteer.volunteer_id, newVolunteer);
    LoggedInUsers.insert(loggedUser.id, loggedUser);

    res.status(201).json({ msg: "Volunteer added successfully" });
});

app.get('/show/allusers/:adminid', (req, res) => {
    const admin_id = req.params.adminid;

    if (!checkAdmin(admin_id)) {
        return res.status(401).json({ msg: "You're not the admin. Only admin is allowed." });
    }

    const users = UserStorage.values().map(user => ({
        id: user.id,
        username: user.username,
        mail: user.mail
    }));

    res.status(200).json(users);
});

app.get("/show/allvolunteers/:adminid", (req, res) => {
    const admin_id = req.params.adminid;

    if (!checkAdmin(admin_id)) {
        return res.status(401).json({ msg: "You're not the admin. Only admin is allowed." });
    }

    const volunteers = VolunteerStorage.values();
    res.status(200).json(volunteers);
});

app.get("/show/allLoggedusers/:adminid", (req, res) => {
    const admin_id = req.params.adminid;

    if (!checkAdmin(admin_id)) {
        return res.status(401).json({ msg: "You're not the admin. Only admin is allowed." });
    }

    const loggedusers = LoggedInUsers.values();
    res.status(200).json(loggedusers);
});

app.put("/volunteer/task/:adminId/addtask/:volunteerid", (req, res) => {
    const volunteer_id = req.params.volunteerid;
    const admin_id = req.params.adminId;
    const userAdminOpt = LoggedInUsers.get(admin_id);

    if (!userAdminOpt || userAdminOpt.role !== "admin") {
        return res.status(401).json({ msg: "You are not the admin" });
    }

    const { title, description } = req.body;

    if (!title || !description) {
        return res.status(400).json({ msg: "Please provide all required fields" });
    }

    const volunteerOpt = VolunteerStorage.get(volunteer_id);

    if (!volunteerOpt) {
        return res.status(404).json({ msg: `Volunteer with id=${volunteer_id} not found` });
    }

    const volunteer = volunteerOpt;
    const newTask = new Task(uuidv4(), volunteer.department, title, description);
    volunteer.tasks.push(newTask);
    VolunteerStorage.insert(volunteer.volunteer_id, volunteer);

    res.status(201).json({ msg: "Task added successfully by admin!", task: newTask });
});

app.get("/volunteer/mytask/:volunteerid", (req, res) => {
    const volunteer_id = req.params.volunteerid;
    const volunteerOpt = VolunteerStorage.get(volunteer_id);

    if (!volunteerOpt) {
        return res.status(404).json({ msg: `Volunteer with id=${volunteer_id} not found` });
    }

    const volunteer = volunteerOpt;
    const myTasks = volunteer.tasks.map(task => ({
        task_id: task.taskid,
        title: task.title,
        description: task.description,
    }));

    const result = {
        volunteer_id: volunteer.volunteer_id,
        name: volunteer.name,
        department: volunteer.department,
        tasks: myTasks
    };

    res.status(200).json({ msg: "My information and tasks assigned", Myinfo: result });
});

export default Server(() => app.listen());

function checkAdmin(adminid: string): boolean {                                                       
    const adminOpt = LoggedInUsers.get(adminid);

    if (!adminOpt || adminOpt.role !== "admin") {
        return false;
    }

    return true;
}

function getCurrentDate(): Date {
    const timestamp = new Number(ic.time());
    return new Date(timestamp.valueOf() / 1000_000);
}
