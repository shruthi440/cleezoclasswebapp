import React, { useEffect, useState } from "react";
import { View, Text, Button, Alert, ScrollView } from "react-native";
import axios from "axios";

const AttendanceNotification = () => {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const checkAttendance = async () => {
      try {
        const response = await axios.get("http://162.215.210.38:5000/api/check-attendance-alert");
        if (response.data.alert) {
          setAlerts(response.data.absentClasses);
          Alert.alert("🚨 Attendance Alert", "Some classes have not recorded attendance!");
        } else {
          setAlerts([]);
        }
      } catch (error) {
        console.error("Error fetching attendance alert:", error);
      }
    };

    checkAttendance();
    const interval = setInterval(checkAttendance, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#f4f4f4", paddingTop: 50, width: "100%" }}>
  <ScrollView contentContainerStyle={{ alignItems: "center", padding: 20 }}>
    <Text
      style={{
        fontSize: 22,
        fontWeight: "bold",
        marginBottom: 10,
        color: "#333",
        fontFamily: "Arial",
        borderBottomWidth: 2,
        borderBottomColor: "#ff5733",
        paddingBottom: 5,
      }}
    >
      📢 Attendance Alert System
    </Text>
    {alerts.length > 0 ? (
  alerts.map((cls, index) => (
    <Text
      key={index}
      style={{
        color: "#5a7488",
        fontSize: 16,
        fontWeight: "bold",
        textAlign: "center", // Align text to the left
        marginTop: 5,
        fontFamily: "Arial",
        borderLeftWidth: 4, // Border only on the left
        borderColor: "rgb(240, 79, 15)", // Black border color
        padding: 10,
        borderRadius: 15, // Remove border radius for a clean left border
        width: "100%", // Full width
        backgroundColor: "#f8f9fa", // Optional: light background for better visibility
      }}
    >
      Attendance missing for Class {cls.class}, Section {cls.section} {"\n"}
      🧑‍🏫 Class Teacher: {cls.class_teacher || "N/A"}
    </Text>
  ))
) : (
  <Text
    style={{
      fontSize: 16,
      fontWeight: "bold",
      textAlign: "center",
      color: "#388e3c",
      fontFamily: "Arial",
      borderLeftWidth: 4, // Border only on the left
      borderColor: "#000", // Black border color
      padding: 10,
      borderRadius: 0,
      width: "100%",
      backgroundColor: "#f8f9fa",
    }}
  >
    ✅ All attendance recorded.
  </Text>
)}

  </ScrollView>
</View>

  );
};

export default AttendanceNotification;
