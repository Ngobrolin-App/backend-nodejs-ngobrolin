pipeline {
    agent any

    stages {

        stage('Check Environment') {
            steps {

                sh 'whoami'
                sh 'pwd'
                sh 'node -v'
                sh 'npm -v'

            }
        }

        stage('Clone Repository') {
            steps {

                git branch: 'main',
                credentialsId: 'github-yudhah52',
                url: 'https://github.com/Ngobrolin-App/backend-nodejs-ngobrolin.git'

            }
        }

        stage('Deploy to Production') {
            steps {

                sh '''
                rsync -rlptDv --delete \
                --exclude=node_modules \
                --exclude=.git \
                --exclude=.env \
                --exclude=uploads \
                ./ /opt/ngobrolin-app/
                '''

            }
        }

        stage('Install Dependencies') {
            steps {

                sh '''
                cd /opt/ngobrolin-app

                npm install
                '''

            }
        }

        stage('Run Migration') {
            steps {

                sh '''
                cd /opt/ngobrolin-app

                npx sequelize-cli db:migrate
                '''

            }
        }

        stage('Restart PM2') {
            steps {

                sh '''
                sudo -u yudhah52 pm2 restart ngobrolin-app
                '''

            }
        }

    }
}