import { Resolver, Mutation, Field, Arg, Ctx, InputType, ObjectType, Query } from "type-graphql";
import { MyContext } from "../types";
import { User } from "../entities/User";
import argon2 from "argon2";

@InputType()
class UsernamePasswordInput {
    @Field()
    username: string
    @Field()
    password: string
}

@ObjectType()
class FieldError{ 
    @Field()
    field: string;
    @Field()
    message: string;
}

@ObjectType()
class UserResponse {
    @Field(() => [FieldError],  {nullable: true})
    errors?: FieldError[];

    @Field(() => User, {nullable: true})
    user?: User;
}


@Resolver()
export class UserResolver {
    @Query(() => [User], {nullable: true})
    async users (
        @Ctx() {em}: MyContext
        ): Promise<User[] | null> {
            return await em.find(User, {});
        }
        
    @Query(() => User, {nullable: true})
    async me (
        @Ctx() {req, em}: MyContext
    ): Promise<User | null> {
        if(!req.session.userId)
            return null;
            
        const user = await em.findOne(User, { id: req.session. userId })
        return user;
    }

    @Mutation(() => UserResponse)
    async register(
        @Arg('options') options: UsernamePasswordInput,
        @Ctx() {em}: MyContext
    ): Promise<UserResponse> {
        if(options.username.length <= 2) {
            return {
                errors: [{
                    field: "Username",
                    message: "Username must be at least 3 or more characters long"
                }]
            }
        }
        if(options.password.length <= 2) {
            return {
                errors: [{
                    field: "Password",
                    message: "Password must be at least 3 or more characters long"
                }]
            }
        }
        const hashedPassword = await argon2.hash(options.password);
        const user = await em.create(User, {username: options.username, password: hashedPassword});
        try {
        await em.persistAndFlush(user);
        } catch (err) {
            if(err.code === '23505' || err.detail.includes("already exists")) {
                //Username already exists
                return {
                    errors: [{
                        field: "Username",
                        message: "Username already exists"
                    }]
                }
            }
        }
        return { user };
    }

    @Mutation(() => UserResponse)
    async login(
        @Arg('options') options: UsernamePasswordInput,
        @Ctx() {em, req}: MyContext
    ) {
        const user = await em.findOne(User, {username: options.username}); 
        // const driver = em.getDriver();
        // const user = await driver.execute("select \"e0\" from \"user\" as \"e0\" where \"e0\".\"username\" iLike \'%" + options.username +"%\'");
        //console.log(user);
        if(!user) {
            return {
                errors: [{
                    field: "Username",
                    message: "Username does not exist"
                }]
            }
        }
        const valid = await argon2.verify(user.password, options.password);
        if(!valid) {
            return {
                errors:[{
                    field: "Password",
                    message: "Password is incorrect"
                }]
            }
        }

        req.session.userId = user.id;

        return {
            user
        }
    }
}