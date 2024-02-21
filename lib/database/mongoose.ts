import mongoose, { Mongoose } from "mongoose";

const MONGODB_URL = process.env.MONGODB_URL;

interface MongooseConnection {
    conn : Mongoose | null;
    promise : Promise<Mongoose> | null;
}

let cached: MongooseConnection = (global as any).mongoose

if(!cached) {
    cached = (global as any).mongoose = {
        conn: null, promise: null
    }
}

export const connectToDatabase = async () => {                   //code 19 to 29 line is having a block of condition which are used for optimization of connection
    if(cached.conn) return cached.conn;                          //which are used for a mongodb

    if(!MONGODB_URL) throw new Error('missing MONGODB_URL');

    cached.promise = cached.promise || mongoose.connect 
    (MONGODB_URL, {dbName: 'Creator', bufferCommands: false })
    
    cached.conn = await cached.promise;

    return cached.conn;

}
