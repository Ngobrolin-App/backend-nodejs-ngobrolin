-- Create extension for UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tbluser
CREATE TABLE tbluser (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL,
    bio TEXT,
    avatarUrl TEXT,
    language VARCHAR(5) DEFAULT 'id',
    isPrivate BOOLEAN DEFAULT false,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create tblconversations
CREATE TABLE tblconversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(20) DEFAULT 'private' CHECK (type IN ('private', 'group')),
    name VARCHAR(100),
    group_image TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create tblconversation_participants
CREATE TABLE tblconversation_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES tblconversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES tbluser(id) ON DELETE CASCADE,
    last_read_message_id UUID,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create tblmessages
CREATE TABLE tblmessages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES tblconversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES tbluser(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'text',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create tblblocked_users
CREATE TABLE tblblocked_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES tbluser(id) ON DELETE CASCADE,
    blocked_user_id UUID REFERENCES tbluser(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, blocked_user_id)
);

-- Create tblfcm_tokens
CREATE TABLE tblfcm_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES tbluser(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraint for last_read_message_id
ALTER TABLE tblconversation_participants 
ADD CONSTRAINT fk_last_read_message 
FOREIGN KEY (last_read_message_id) REFERENCES tblmessages(id);

-- Create indexes for better performance
CREATE INDEX idx_user_username ON tbluser(username);
CREATE INDEX idx_conversation_participants_conversation ON tblconversation_participants(conversation_id);
CREATE INDEX idx_conversation_participants_user ON tblconversation_participants(user_id);
CREATE INDEX idx_messages_conversation ON tblmessages(conversation_id);
CREATE INDEX idx_messages_sender ON tblmessages(sender_id);
CREATE INDEX idx_blocked_users_user ON tblblocked_users(user_id);
CREATE INDEX idx_fcm_tokens_user ON tblfcm_tokens(user_id);