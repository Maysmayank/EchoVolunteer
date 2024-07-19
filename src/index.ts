import { v4 as uuidv4 } from 'uuid';
import { Server, StableBTreeMap, ic } from 'azle';
import express from 'express';


// Class to represent a User
class User {
    id: string;                                                                           // Unique identifier for the user
    username: string;                                                                     // Username of the user
    password: string;                                                                     // Password of the user
    mail: string;                                                                         // Email address of the user
    role: string;                                                                         // Role of the user (e.g., admin, volunteer, etc.)
    createdAt: Date;                                                                      // Date when the user was created

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
    taskid: string;                                                                         // unique identifier for the task
    department: string;                                                                     // Department responsible for the task
    title: string;                                                                          // Title of the task
    description: string;                                                                    // Description of the task

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
    volunteer_id: string;                                                                   // identifier for the volunteer
    name: string;                                                                           // Name of the volunteer
    address: string;                                                                        // Address of the volunteer
    phone_number: number;                                                                   // Phone number of the volunteer
    centre: string;                                                                         // Centre to which the volunteer is assigned
    tasks: Task[];                                                                          // List of tasks assigned to the volunteer
    department: string;                                                                     // Department of the volunteer
    role: string;                                                                           // Role of the volunteer
    createdAt: Date;                                                                        // Date when the volunteer was created

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
/**
* We utilize the StableBTreeMap for storage in this contract due to its durability and efficiency. 
* StableBTreeMap is a self-balancing tree that maintains data even when the canister is upgraded which ensures that critical data is not lost during these upgrades.
* The Reason to leversge is beacuse the operations for inserting, retrieving, and removing items have a constant time complexity (O(1)), making it efficient.
*
*/
const VolunteerStorage = StableBTreeMap<string, Volunteer>(0);                                // Storage for Volunteers, keyed by volunteer_id

const UserStorage = StableBTreeMap<string, User>(1);                                          // Storage for Users, keyed by user_id

const loggedinUsers = StableBTreeMap<string, User>(2);                                        // Storage for logged-in Users, keyed by login id


export default Server(() => {                                                                 // creating an HTTP server that will handle requests to our canister.
    const app = express(); 
    app.use(express.json());
    
    
    
    app.post("/signup/user", (req, res) => {
        let { username, password, mail } = req.body;                                         // fetching the username, mail and passwrod from user
        
        let newUser = new User(uuidv4(), username, password, mail,"not assigned",getCurrentDate());         // passing the values to the user constructor
        
        UserStorage.insert(newUser.id, newUser);                                             // inserting the value to the UserStorage to store the data 
        
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

    app.post("/assign/role/:loginid",(req,res)=>{   
        /*this route will heandle the assign of role to the newly created user after he/she has been loggede in 
        * 
        * first , We will get the login id through @params 
        * 
        * then checks if the user has logged in or not then give response based on the validation check
        * 
        * Now, user have to assign role to himself as admin by passing the role as admin in JSON format  there can be different roles but right now  we will
        * focused on admin only 
        * 
        * then we will change the role and insert in the LoginUsers Storage to store the data 
        * 
        *  and pass the response as "role assigned " to the admin and show his/ her information 
        * 
        * @@@              Note  Login id , signup id and volunteer id are treated as equal (signupid = loginid = volunteerid) they are same
        */

        let login_id=req.params.loginid;

        const loggedUser=loggedinUsers.get(login_id).Some;
        const islogged_id=loggedUser?.id;
        
        if(!islogged_id){
            res.status(403).json({msg:"User not loggedIn !"})                                     // 403 represents invalid credentials
        }
        else{
            const{ role }=req.body;                                                                // enter role as admin ;
         
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

    app.post("/form/volunteer/:loginid", (req, res) => {
        /**
         * this route focuses on getting and adding  new volunteers once they have been logged in.
         * @params (loginid) we will get the login id from parameter
         * set the role to volunteer by default
         * 
         * checking if logged in user exists if yes add the volunteer to the VolunteerStorage and store it otherwise responds user not logged in  
         * 
         * checks if the user existed is admin or not if the user is already admin set his/ her role to admin and volunteer both
         * 
         * if user is not the admin set the role to volunteer only
         * 
         * get the details of  name, address, phone_number, centre, department from the user 
         * 
         * and  pass it to the  Volunteer's constructor 
         * 
         * assigns the role to both loginUsers storage and VolunteerStorage and store it 
         * 
         * response shows volunteer added successfully   
         * 
         * @Note  Login id , signup id and volunteer id are treated as equal (signupid = loginid = volunteerid) they are same 
         *  
         */
        const loginid=req.params.loginid;
        const loggeduser=loggedinUsers.get(loginid).Some;
        const logged_id=loggeduser?.id;
        
        let role="volunteer";
        if(!logged_id){                                                                            // 403 represents invalid credentials
            res.status(403).json({msg:"user not loggedIn !"})
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
        /**
         * route to show all users limited details (id ,username and mail) and only admin can access this route 
         * 
         * @Note adminid and loginid are considered to be same you need to pass the loginid as adminid for easy access 
         * 
         * @params (adminid)  get the admin id from parmeters  
         * 
         * get the all users  from Userstorage 
         * 
         * @check() checks if the user admin or not 
         * 
         * if no , sends the response " you're not the admin. only admin is allowed "
         * 
         * if yes , show the all the users deatils to the admin 
         * 
         */
        const admin_id=req.params.adminid;
        const users = UserStorage.values();

        const result=check(admin_id);
        
        if(!result){
            res.status(401).json({msg:"you're not the admin. only admin is allowed "})
        }
        else{
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
        /**
         * this route show all the volunteers who are working in NGO or any organisation and this route can be accessed by admin only
         * 
         * @params adminid : ---- get the adminid (i.e login_id)  from  parameter
         * 
         * @check function  it checks if admin exists or not 
         * 
         * if admin exists show all the volunteers details to the admin 
        
        * otherwise send a response " you're not the admin. only admin is allowed"
        
        */
        
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
        /**
         * this route show all the logged users to the admin only
         * 
         * @params adminid : ---- get the adminid (i.e login_id)  from  parameter
         * 
         * @check function  it checks if admin exists or not 
         * 
         * and shows the logged users if admin exists otherwise not     
        */

        const admin_id=req.params.adminid;
        const result=check(admin_id);
       
        if(!result){
            res.status(401).json({msg:"you're not the admin. only admin is allowed "})
        }
        
        else{
            const loggedusers = loggedinUsers.values();
            res.status(200).json(loggedusers);
        }
    })


    app.put("/volunteer/task/:adminId/addtask/:volunteerid", (req, res) => {      
        
        /*  @Note  Login id , signup id , volunteer id and adminid are treated as equal (signupid = loginid = volunteerid=adminid) they are same for easy access
    
            @params (volunteerid) represents the the id of the volunteer to which we would like to assign a task
            @params (adminId ) represents the id of the admin who is assigning and adding the task to other volunteer 
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
                    volunteer.tasks.push(newTask);                                                    // adding new task to volunteer
                    VolunteerStorage.insert(volunteer.volunteer_id, volunteer);                       // add the the task to the VolunteerStorage
       
                    res.status(201).json({ msg: "Task added successfully by admin!", task: newTask });
                }
            }
        });

        
    app.get("/volunteer/mytask/:vounteerid", (req, res) => {
        /**
         *  this route get the volunteer id and show the task to the volunteer who would access this endpoint or route
         * 
         * @params (volunteerid ) getting the volunteerid from parameter 
         * 
         * get the volunteer using his /her id and pass it to the volunteerStorage and get the  volunteer details         
         *
         * checks if the volunteer exists or not 
         *
         * if no , send the response 
         * 
         * is yes , show the details of the task along with id, name and department
         * 
         * @Note  Login id , signup id and adminid are treated as equal (signupid = loginid = volunteerid) they are same for easy access
         */

        const volunteer_id = req.params.vounteerid;
        const volunteerOpt = VolunteerStorage.get(volunteer_id);
        
        if ("None" in volunteerOpt) {
            res.status(404).send(`the message with id=${volunteer_id} not found or Volunteer Not exists`);
        } else {
            const volunteer=volunteerOpt.Some;
            const mytask=volunteer.tasks.map((task)=>(
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

