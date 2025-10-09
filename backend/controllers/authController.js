const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'a2bec79f51d4bc62954b6e7453870bf5a270bd742cf1b14096818384ea4b5163ac8c62a87a0843904bcaf2b6ec29efe0d4fd8b12401130ba250e69e14c14749c';

const register = async (req, res) => {
    const {name, email, password} = req.body;

    try {
        const existingUser = await User.findOne({email});
        if (existingUser) {
            return res.status(400).json({message: 'User already exists'});
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name,
            email,
            password: hashedPassword
        });

        await newUser.save();

        const token = jwt.sign(
            { _id: newUser._id, email: newUser.email }, 
            JWT_SECRET, 
            { expiresIn: '72h' }
        );

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token,
            user: {id: newUser._id, name: newUser.name, email: newUser.email}
        });
    } catch (error) {
        console.error("Error registering user: ", error);
        res.status(500).json({error: 'error registering user'});
    }
};

const login = async (req, res) => {
    const {email, password} = req.body;
    
    const user = await User.findOne({email});
    if (!user) {
        return res.status(400).json({message: 'Invalid email or password'});
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        return res.status(400).json({message: 'Invalid email or password'});
    }

    const token = jwt.sign(
        { _id: user._id, email: user.email }, 
        JWT_SECRET, 
        { expiresIn: '72h' }
    );

    res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        user: {id: user._id, name: user.name, email: user.email}
    });
}

module.exports =  {
    register,
    login
};