import { AuthCredentials } from "../entities/authCredentials.entity";
import jwt from "jsonwebtoken";
import { SQSService } from "./sqs.service";
import { EmailPayload } from "../models/emailPayload.type";
import logger from "../configs/logger.config";
import bcrypt from "bcrypt";
import { AccountRegisteredEmailTemplate } from "../constants/email.templates";
import { envVars } from "../configs/envVars.config";
import { ServiceResponse } from "../models/serviceResponse.type";

export class AuthService {
  public async registerNewUser(
    newEmail: string,
    newUsername: string,
    newPassword: string,
    newRole: string,
  ): Promise<ServiceResponse> {
    try {
      const result = await AuthCredentials.findOne({ username: newUsername });
      if (result === null) {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const registerNewUser = new AuthCredentials({
          email: newEmail,
          username: newUsername,
          password: hashedPassword,
          role: newRole,
        });
        const newUser = await registerNewUser.save();

        const userId = newUser.user_id;
        await AuthCredentials.findOneAndUpdate(
          { user_id: userId },
          { createdBy: userId },
        );
        const emailPayload: EmailPayload = {
          to: newEmail,
          subject: AccountRegisteredEmailTemplate.subject,
          text: AccountRegisteredEmailTemplate.text.replace(
            "{{username}}",
            newUsername,
          ),
        };

        await new SQSService().sendMessageToQueue(emailPayload);
        logger.info("New user registered");
        return {
          status: 201,
          message: "New user registered",
        };
      } else if (result instanceof AuthCredentials) {
        logger.info("username already exists");
        return {
          status: 400,
          message: "username already exists",
        };
      } else {
        logger.info("unknown error in registerNewUser");
        throw new Error("unknown error in registerNewUser");
      }
    } catch (error) {
      logger.error("error in registerNewUser", error);
      return {
        status: 500,
        message: "internal server error",
      };
    }
  }
  public async login(
    loginUsername: string,
    loginPassword: string,
  ): Promise<ServiceResponse> {
    try {
      const result = await AuthCredentials.findOne({ username: loginUsername });

      if (
        result instanceof AuthCredentials &&
        (await bcrypt.compare(loginPassword, result.password))
      ) {
        const token = jwt.sign(
          {
            user_id: result.user_id,
            username: loginUsername,
            role: result.role,
          },
          envVars.JWTSECRET as string,
          {
            expiresIn: "1d",
          },
        );
        logger.info("User just logged in");
        return {
          status: 200,
          message: "You are logged in",
          token: token,
        };
      } else {
        logger.info("Invalid username or password");
        return {
          status: 401,
          message: "Please check your username and password",
        };
      }
    } catch (error) {
      logger.error("Error in login", error);
      throw new Error("Unknown error in login");
    }
  }
}
