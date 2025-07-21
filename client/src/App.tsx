import React from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

function Router() {
  return (
    <Switch>
      <Route path="/login">
        <div style={{ padding: "20px" }}>
          <h1>Login Page</h1>
          <p>Login functionality will be implemented here.</p>
        </div>
      </Route>
      <Route path="/dashboard">
        <div style={{ padding: "20px" }}>
          <h1>Dashboard</h1>
          <p>Dashboard will be implemented here.</p>
        </div>
      </Route>
      <Route path="/">
        <div style={{ padding: "20px" }}>
          <h1>Welcome to Simpix</h1>
          <p>Application is loading correctly!</p>
          <p>Navigate to <a href="/dashboard">/dashboard</a> or <a href="/login">/login</a></p>
        </div>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
