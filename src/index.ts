// cannister code goes here
import { v4 as uuidv4 } from 'uuid';
import { Server, StableBTreeMap, ic } from 'azle';
import express from 'express';

class User {
    id: string;
    username: string;
    password: string;
    mail: string;
    role:string;
    createdAt: Date;
    constructor(id: string, username: string, password: string, mail: string,role:string,createdAt:Date) {
        this.id = id;
        this.username = username;
        this.password = password;
        this.mail = mail;
        this.role=role;
        this.createdAt = createdAt;
    }
}
class Task {
    taskid: string;
    department:string;
    title: string;
    description: string;
    constructor(taskid: string, department:string,title: string, description: string) {
        this.taskid = taskid;
        this.department=department;
        this.title = title;
        this.description = description;
    }
}
class Volunteer {

    volunteer_id: string;
    name: string;
    address: string;
    phone_number: number;
    centre: string;
    todos: Task[];
    department: string;
    role:string;
    createdAt: Date;

    constructor(volunteer_id: string, name: string, address: string, phone_number: number, centre: string, department: string,role:string,createdAt:Date) {
        this.volunteer_id = volunteer_id;
        this.name = name;
        this.address = address;
        this.phone_number = phone_number;
        this.centre = centre;
        this.department = department;
        this.todos = [];
        this.role=role;
        this.createdAt = createdAt;
    }

}
const VolunteerStorage = StableBTreeMap<string, Volunteer>(0);
const UserStorage = StableBTreeMap<string, User>(1);
const loggedinUsers=StableBTreeMap<string,User>(2);

export default Server(() => {
    const app = express();
    app.use(express.json());

    app.post("/assign/role/:loginid",(req,res)=>{
        let login_id=req.params.loginid;

        const loggedUser=loggedinUsers.get(login_id).Some;
        const islogged_id=loggedUser?.id;
        
        if(!islogged_id){
            res.status(401).json({msg:"User not loggedIn !"})
        }
        else{
            const{ role }=req.body;                                                                 // enter role as admin ;
         
            if("None" in loggedUser){
                res.status(404).send(`the message with id=${login_id} not found`);
            }
            else{
                loggedUser.role=role;
                loggedinUsers.insert(loggedUser.id,loggedUser);
                res.status(201).json({msg:"role assigned",info:loggedUser});
            }
        }
    })
    
    app.post("/signup/user", (req, res) => {
        let { username, password, mail } = req.body;                                       // fetching the username, mail and passwrod from user
        let newUser = new User(uuidv4(), username, password, mail,"not assigned",getCurrentDate());         // passing the values to the user constructor
        UserStorage.insert(newUser.id, newUser);                                           // inserting the value to the UserStorage to store the data 
        res.status(201).json({ msg: " User signed up successfully! " })                    
    })

    app.post("/login/user",(req, res) => {
        let { mail,password } = req.body;                                                   // fetching the mail and password from user
        const user = UserStorage.values().filter(user => user.mail === mail)[0];            // getting the user object from UserStorage using the mail
        if(!user){                                                                          // if user not exist then sends response
            res.status(401).json({msg:"user not exist. SIGN UP PLEASE"})                
        }
        let isvalidPassword= password===user.password ? true:false;                         // checks the password provided is matching with the one which was created at the time of signing up 
        if(!isvalidPassword){
            return res.status(400).json({ msg: "Invalid username or password" });
        }
        loggedinUsers.insert(user.id, user);                                                // inserting the user in loggedinUsers storage 
        res.status(200).json({ msg: "User login successful", userdetails: user });     
    })

    app.post("/logout/:userId", (req, res) => {                                             
                                                                                        
        const { userId } = req.params;                                                       // getting the userid from params to logout the user using userid
        const logout_User = loggedinUsers.remove(userId);                                    // removing the the user from loggedinUsers storage 
        
        if (logout_User) {                                                                   // checking if user exsts or not                                    
           res.status(200).json({ message: "User logged out successfully" });
        } else {
           res.status(401).json({ message: "User not logged in" });
        }
    })

    app.post("/form/volunteer/:loginid", (req, res) => {
        const loginid=req.params.loginid;
        const loggeduser=loggedinUsers.get(loginid).Some;
        const logged_id=loggeduser?.id;
        let role="volunteer";
        if(!logged_id){
            res.status(401).json({msg:"user not loggedIn !"})
        }
        else{
            if(loggeduser.role==="admin"){
                role="admin and volunteer";
            }
            let { name, address, phone_number, centre, department } = req.body;
            let newVolunteer = new Volunteer(loggeduser.id, name, address, phone_number, centre, department,role,getCurrentDate());
            loggeduser.role=role;
            VolunteerStorage.insert(newVolunteer.volunteer_id, newVolunteer);
            loggedinUsers.insert(loggeduser.id,loggeduser);

            res.status(201).json({ msg: " Volunteer added successfully " })
        }
      
    })

    app.get('/show/allusers/:adminid', (req, res) => {
        const admin_id=req.params.adminid;
        const users = UserStorage.values();

        const result=check(admin_id);
        if(!result){
            res.status(401).json({msg:"you're not the admin. only admin is allowed "})
        }else{
            const user_details = users.map(user => {
                const User = UserStorage.get(user.id).Some;
                return {
                    id:user.id,
                    username: user.username,
                    mail: user.mail
                };
            });
            res.status(200).json(user_details);
        }
        
    });

    app.get("/show/allvolunteers/:adminid", (req, res) => {
        const admin_id=req.params.adminid;
        const result=check(admin_id);
        if(!result){
            res.status(401).json({msg:"you're not the admin. only admin is allowed "})
        }
        else{
            const volunteers = VolunteerStorage.values();
            res.status(200).json(volunteers);
        }
    })

    app.get("/show/allLoggedusers/:adminid",(req,res)=>{
        const admin_id=req.params.adminid;
        const result=check(admin_id);
        if(!result){
            res.status(401).json({msg:"you're not the admin. only admin is allowed "})
        }else{
            const loggedusers = loggedinUsers.values();
            res.status(200).json(loggedusers);
        }
    })

    app.get("/volunteer/mytask/:vounteerid", (req, res) => {
        const volunteer_id = req.params.vounteerid;
        const volunteerOpt = VolunteerStorage.get(volunteer_id);
        
        if ("None" in volunteerOpt) {
            res.status(404).send(`the message with id=${volunteer_id} not found`);
        } else {
            const volunteer=volunteerOpt.Some;
            const mytask=volunteer.todos.map((task)=>(
                {
                    task_id:task.taskid,
                    title:task.title,
                    description:task.description,
                }
            ));
            const result = {
                volunteer_id: volunteer.volunteer_id,
                name: volunteer.name,
                department: volunteer.department,
                tasks: mytask
            };

            res.json({ msg: "My information and task assigned !!", Myinfo: result });
        }
    })
   
    app.put("/volunteer/task/:adminId/addtask/:volunteerid", (req, res) => {      
        
    /* 
        volunteerid represents the the id of the volunteer to which we would like to assign a task
        adminId represents the id of the admin who is assigning and adding the task to other volunteer 
    */

        const volunteer_id = req.params.volunteerid;                                              // fetching the volunteer id from parameters   
        const admin_id=req.params.adminId;                                                        // fetching admin Id  from parameters
        const userAdmin=loggedinUsers.get(admin_id).Some;                                         // getting user admin from loggedinUsers storage
        
        if(!userAdmin?.id){                                                                       // checking if user is admin or not using his id
            res.json({msg:"Admin is not logged In !!"})
        }
        
        else{
            const { title, description } = req.body;                                              // getting the title and description  from user in json fromat 
            const volunteerOpt = VolunteerStorage.get(volunteer_id);                             
            
            if ("None" in volunteerOpt) {                                                         // If volunteer not found then send the response             
                res.status(404).send(`Volunteer with id=${volunteer_id} not found`);              
            }
            else if(userAdmin.role!=="admin"){                                                    // checking if the person who is adding task is admin or not
                res.status(401).json({msg:"You are not the admin --"})                          
            }
            else{

                const volunteer = volunteerOpt.Some;
                const department=volunteer.department;         
                const newTask = new Task(uuidv4(), department,title, description);                // assigning task to the volunteer 
                volunteer.todos.push(newTask);                                                    // adding new task to volunteer
                VolunteerStorage.insert(volunteer.volunteer_id, volunteer);                       // add the the task to the VolunteerStorage
   
                res.status(201).json({ msg: "Task added successfully by admin!", task: newTask });
            }
        }
    });
    
    return app.listen();
})

function check(adminid:string):(boolean){                                                         
    /*
    its a function to quick check for the admin and used in only get routes
    this function takes adminid and return boolean value 
    if admin present return true otherwise false
    */ 
    const adminOpt = loggedinUsers.get(adminid);

    if ("None" in adminOpt) {
        return false;
    }
    const admin = adminOpt.Some;
    if (admin.role !== "admin") {
        return false
    }

    return true;
}

function getCurrentDate() {
    /*
     Retrieves the current date and time from the Internet Computer's system time.
     
     returns The current date and time as a JavaScript Date object.
     */
    const timestamp = new Number(ic.time());
    return new Date(timestamp.valueOf() / 1000_000);
 }

