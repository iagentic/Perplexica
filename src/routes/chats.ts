import express from 'express';
import logger from '../utils/logger';
import db from '../db/index';
import { eq, sql} from 'drizzle-orm';
import { chats, messages } from '../db/schema';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    let userSessionId = req.headers['user-session-id'] ? req.headers['user-session-id'].toString() : '';
    if (userSessionId == '') {
      return res.status(200).json({ chats: []});
    }

    let chatRecords = await db.query.chats.findMany({
      where: eq(chats.userSessionId, userSessionId),
    });

    chatRecords = chatRecords.reverse();
    let maxRecordLimit = 20;

    if (chatRecords.length > maxRecordLimit) {
      const deleteChatsQuery = sql`DELETE FROM chats
        WHERE usersessionid = ${userSessionId} AND (
          timestamp IS NULL OR 
          timestamp NOT IN (
            SELECT timestamp 
            FROM chats 
            WHERE usersessionid = ${userSessionId} 
            ORDER BY timestamp DESC 
            LIMIT ${maxRecordLimit}
          )
        )
      `;
      await db.run(deleteChatsQuery);
      const deleteMessagesQuery = sql`DELETE FROM messages
        WHERE chatid NOT IN (
          SELECT id 
          FROM chats
        )
      `;
      await db.run(deleteMessagesQuery);
    }
    return res.status(200).json({ chats: chatRecords });
  } catch (err) {
    res.status(500).json({ message: 'An error has occurred.' });
    logger.error(`Error in getting chats: ${err.message}`);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const chatExists = await db.query.chats.findFirst({
      where: eq(chats.id, req.params.id),
    });

    if (!chatExists) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    const chatMessages = await db.query.messages.findMany({
      where: eq(messages.chatId, req.params.id),
    });

    return res.status(200).json({ chat: chatExists, messages: chatMessages });
  } catch (err) {
    res.status(500).json({ message: 'An error has occurred.' });
    logger.error(`Error in getting chat: ${err.message}`);
  }
});

router.delete(`/:id`, async (req, res) => {
  try {
    const chatExists = await db.query.chats.findFirst({
      where: eq(chats.id, req.params.id),
    });

    if (!chatExists) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    await db.delete(chats).where(eq(chats.id, req.params.id)).execute();
    await db
      .delete(messages)
      .where(eq(messages.chatId, req.params.id))
      .execute();

    return res.status(200).json({ message: 'Chat deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'An error has occurred.' });
    logger.error(`Error in deleting chat: ${err.message}`);
  }
});

export default router;
