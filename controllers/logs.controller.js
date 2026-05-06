import { uploadToS3 } from "../config/s3.js";
import Agency from "../models/agency.model.js";
import Logs from "../models/logs.model.js";
import moment from "moment-timezone";
        
export const createLogs = async (req, res) => {
    try {
        const { userId, location, type, agencyId, remarks } = req.body;

        if (!userId || !location || !type) {
            return res.status(400).json({
                success: false,
                message: "userId, location and type are required",
            });
        }

        if (type === "Visit" && !req.file) {
            return res.status(400).json({
                success: false,
                message: "Image is required for Visit",
            });
        }

        let imageUrl = null;

        if (req.file) {
            imageUrl = await uploadToS3(req.file, `AgentVisit/${userId}/`);
        }

        const allowedTypes = ["Login", "Logout", "Visit"];

        if (!allowedTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid log type. Allowed: Login, Logout, Visit",
            });
        }

        const now = new Date().toISOString();
        const newLog = await Logs.create({
            userId,
            createdAt: now,
            location,
            type,
            agencyId,
            remarks,
            pic: imageUrl,
        });

        return res.status(200).json({
            success: true,
            message: "Log created successfully",
            data: newLog,
        });

    } catch (error) {
        console.error("Create Log Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const getAllLogs = async (req, res) => {
    try {
        const logs = await Logs.scan().exec();

        return res.status(200).json({
            success: true,
            count: logs.count,
            data: logs,
        });

    } catch (error) {
        console.error("Get All Logs Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const getLogByUserId = async (req, res) => {
    try {
        const { id } = req.params;

        const logs = await Logs.scan("userId").eq(id).exec();

        return res.status(200).json({
            success: true,
            count: logs.count,
            data: logs,
        });

    } catch (error) {
        console.error("Get Log By User ID Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const getLogByUserIdAndDate = async (req, res) => {
  try {
    console.log("Timezone from frontend:", req.query.timezone);
    const timezone = req.query.timezone || "Asia/Kolkata";
    const { id, date } = req.params;

    const startDate = new Date(`${date}T00:00:00`);
    const endDate = new Date(`${date}T23:59:59.999`);

    const logs = await Logs.query("userId")
      .using("userIdCreatedAtIndex")
      .eq(id)
      .where("createdAt")
      .between(startDate.toISOString(), endDate.toISOString())
      .exec();

    const logsWithAgencyName = await Promise.all(
      logs.map(async (item) => {
        const agency = await Agency.get(item.agencyId);

        return {
          ...item.toJSON(), // important for dynamoose
          agencyName: agency?.agencyName || null,

          localTime: moment(item.createdAt)
  .tz(timezone)
  .format("hh:mm A")    
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: logsWithAgencyName.length,
      data: logsWithAgencyName,
    });

  } catch (error) {
    console.error("Get Log By User ID And Date Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
