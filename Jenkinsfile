pipeline {
    agent any

    environment {
        APP_DIR = '/opt/ngobrolin-app'
        PM2_APP_NAME = 'ngobrolin-app'
    }

    stages {

        stage('Check Environment') {
            steps {
                sh 'whoami'
                sh 'pwd'
                sh 'node -v'
                sh 'npm -v'
            }
        }

        // already auto checkout by jenkins pipeline from scm, so no need to clone again
        // stage('Clone Repository') {
        //     steps {

        //         git branch: 'main',
        //         credentialsId: 'github-yudhah52',
        //         url: 'https://github.com/Ngobrolin-App/backend-nodejs-ngobrolin.git'

        //     }
        // }

        stage('Deploy to Production') {
            steps {
                sh '''
                rsync -rDv \
                --delete \
                --no-perms \
                --no-owner \
                --no-group \
                --exclude=node_modules \
                --exclude=.git \
                --exclude=.env \
                --exclude=uploads \
                ./ ${APP_DIR}/
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                sh '''
                cd ${APP_DIR}

                npm ci
                '''
            }
        }

        stage('Run Migration') {
            steps {
                sh '''
                cd ${APP_DIR}

                npx sequelize-cli db:migrate
                '''
            }
        }

        stage('Restart PM2') {
            steps {
                sh '''
                sudo -u yudhah52 pm2 restart ${PM2_APP_NAME}
                '''
            }
        }

    }
}