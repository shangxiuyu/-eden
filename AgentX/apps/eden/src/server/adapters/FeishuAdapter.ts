import * as lark from "@larksuiteoapi/node-sdk";
import { PlatformAdapter, platformService, PlatformConfig } from "../services/PlatformService";

export class FeishuAdapter implements PlatformAdapter {
  platform = "feishu";
  private clients: Map<string, lark.Client> = new Map();
  private wsClients: Map<string, lark.WSClient> = new Map();

  private getClient(agentId: string): lark.Client | undefined {
    let client = this.clients.get(agentId);
    if (client) return client;

    const platformConfig = platformService.getConfig(this.platform, agentId);
    if (!platformConfig || !platformConfig.enabled) {
      console.warn(`[FeishuAdapter] No config found or disabled for ${this.platform}:${agentId}`);
      return undefined;
    }

    const { appId, appSecret } = platformConfig.config;
    if (!appId || !appSecret) return undefined;

    client = new lark.Client({
      appId,
      appSecret,
      disableTokenCache: false,
    });
    this.clients.set(agentId, client);
    return client;
  }

  async start(configs: PlatformConfig[]) {
    console.log(`[FeishuAdapter] Starting with ${configs.length} configs`);
    for (const config of configs) {
      console.log(
        `[FeishuAdapter] Checking config for agent: ${config.agentId}, Enabled: ${config.enabled}`
      );
      if (!config.enabled) continue;
      const { appId, appSecret } = config.config;
      if (!appId || !appSecret) {
        console.warn(`[FeishuAdapter] Missing appId or appSecret for agent ${config.agentId}`);
        continue;
      }

      // Start Long Connection (WS)
      // Note: Long connection usually doesn't require verification token or encrypt key for basic usage,
      // but strictly speaking, it replaces the webhook endpoint.
      // We can just try to start it.
      try {
        console.log(
          `[FeishuAdapter] Initializing WS Client for ${config.agentId} (AppID: ${appId.slice(0, 5)}...)`
        );
        const wsClient = new lark.WSClient({
          appId,
          appSecret,
          loggerLevel: lark.LoggerLevel.debug, // Set to debug to see SDK logs
        });

        const dispatcher = new lark.EventDispatcher({}).register({
          "im.message.receive_v1": async (data: any) => {
            try {
              const event = data.message;
              console.log(
                `[FeishuAdapter] Message type: ${event.message_type}, content: ${event.content}`
              );
              if (event.message_type === "text") {
                const content = JSON.parse(event.content).text;
                const sender = data.sender;
                const externalUserId = sender?.sender_id?.open_id;
                console.log(`[FeishuAdapter] Sender: ${externalUserId}, Content: ${content}`);

                if (externalUserId) {
                  const cleanContent = content.replace(/@_user_\w+\s*/g, "").trim();

                  await platformService.handleIncomingMessage(
                    this.platform,
                    externalUserId,
                    config.agentId,
                    cleanContent
                  );
                }
              }
            } catch (err) {
              console.error(
                `[FeishuAdapter] Error processing WS event for ${config.agentId}:`,
                err
              );
            }
          },
        });

        await wsClient.start({
          eventDispatcher: dispatcher,
        });
        console.log(`[FeishuAdapter] WS client start() called for ${config.agentId}`);
        this.wsClients.set(config.agentId, wsClient);
        console.log(`[FeishuAdapter] WS client successfully started for agent ${config.agentId}`);
      } catch (error) {
        console.error(
          `[FeishuAdapter] Failed to start WS client for agent ${config.agentId}:`,
          error
        );
      }
    }
  }

  async handleWebhook(agentId: string, body: any, headers: Record<string, string>): Promise<any> {
    const platformConfig = platformService.getConfig(this.platform, agentId);
    if (!platformConfig || !platformConfig.enabled) {
      throw new Error("Feishu configuration not found or disabled");
    }

    const { encryptKey, verificationToken } = platformConfig.config;

    // Use lark.EventDispatcher to handle the webhook
    const dispatcher = new lark.EventDispatcher({
      encryptKey,
      verificationToken,
    }).register({
      "im.message.receive_v1": async (data) => {
        const event = data.message;
        if (event.message_type === "text") {
          const content = JSON.parse(event.content).text;
          const externalUserId = data.sender?.sender_id?.open_id;

          if (externalUserId) {
            // Strip bot mention if any (e.g. "@bot hello" -> "hello")
            // Feishu sends the text with mentions included.
            const cleanContent = content.replace(/@_user_\w+\s*/g, "").trim();

            await platformService.handleIncomingMessage(
              this.platform,
              externalUserId,
              agentId,
              cleanContent
            );
          }
        }
      },
    });

    // We need to adapt the incoming request to what the dispatcher expects
    // The dispatcher expects a comprehensive request object or specific parameters
    // Since we are called from index.ts where body is already parsed (or raw), we need to be careful.
    // However, the standard lark SDK dispatcher typically works with raw body for signature verification.

    // NOTE: In the `index.ts`, we need to change how we call this.
    // We will assume `body` passed here is the raw body object for now,
    // BUT typically dispatcher.invoke() takes { body, headers }.

    // Let's return the result of the dispatcher
    const result = await dispatcher.invoke({
      body: body, // Ensure this is the RAW body object/buffer/string as expected by SDK?
      // Actually SDK expects `body` to be object if already parsed, OR string/buffer.
      // But for signature verification it strongly prefers raw.
      headers: headers,
    });

    return result;
  }

  async sendMessage(agentId: string, externalUserId: string, content: string): Promise<void> {
    const client = this.getClient(agentId);
    if (!client) {
      console.warn(`[FeishuAdapter] Cannot send message: No client for agent ${agentId}`);
      return;
    }

    try {
      console.log(`[FeishuAdapter] Sending message to ${externalUserId} (Agent: ${agentId})`);
      await client.im.message.create({
        params: {
          receive_id_type: "open_id",
        },
        data: {
          receive_id: externalUserId,
          msg_type: "text",
          content: JSON.stringify({ text: content }),
        },
      });
      console.log(`[FeishuAdapter] Message successfully sent to ${externalUserId}`);
    } catch (e: any) {
      console.error("[FeishuAdapter] Failed to send message:", e.response?.data || e.message);
    }
  }
}

export const feishuAdapter = new FeishuAdapter();
