module.exports = {
  apps: [
    {
      name: "ngobrolin-app",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
