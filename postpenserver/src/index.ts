import "reflect-metadata";
import{ MikroORM } from "@mikro-orm/core";
import { __prod__ } from "./constants";
import microConfig from "./mikro-orm.config";
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import redis from 'redis';
import session from 'express-session';
import connectRedis from 'connect-redis'

const main = async () => {
 const orm = await MikroORM.init(microConfig);
 await orm.getMigrator().up();

 const app = express();

 const RedisStore = connectRedis(session);
 const redisClient = redis.createClient();

 app.use(
   session({
   name: 'qid',
   store: new RedisStore( {client: redisClient,
    disableTouch: true,
    //disableTTL: true
  } ),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
    httpOnly: true,
    sameSite: 'lax', //protects csrf
    //secure: __prod__ //https only
  },
   secret: "asdf",
   resave: false,
   saveUninitialized: false
}));

 const apolloServer = new ApolloServer({
    schema: await buildSchema({
     resolvers: [PostResolver, UserResolver],
     validate: false
   }),
   context: ({ req, res}) => ({em: orm.em, req, res})
 });

 apolloServer.applyMiddleware({ app });

 app.listen(4321, () => {
   console.log("server started on localhost:4321")
 })
};

main().catch(err => {
   console.log(err);
});
