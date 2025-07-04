import React from "react";
import { useAuth } from "../auth/AuthContext";
import ManagerEmployeeScheduleView from "./ManagerEmployeeScheduleView";
import EmployeeScheduleView from "./EmployeeScheduleView";

const ScheduleView = () => {
  const { user } = useAuth();

  // Determine which view to show based on user role
  if (user?.role === "MANAGER" || user?.role === "ADMIN") {
    return <ManagerEmployeeScheduleView />;
  } else {
    return <EmployeeScheduleView />;
  }
};

export default ScheduleView;
