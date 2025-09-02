/**
 * Discord Member Scraper
 *
 * Credits:
 * - John-online (https://github.com/John-online)
 * - SnepCnep (https://github.com/SnepCnep)
 */

import "dotenv/config";

import Sleep from "./utils/Sleep";
import chalk from "chalk";
import { Client, Guild, GuildMember, Collection } from "discord.js-selfbot-v13";
import config from "../config.json";
import path from "node:path";
import fs, { existsSync } from "node:fs";
import Database from "./database";

interface CompiledData {
  [userId: string]: string[];
}

interface MemberData {
  id: string;
  roles: string[];
}

interface GuildData {
  name: string;
  users: Set<string>;
}

interface GuildsMap {
  [guildId: string]: GuildData;
}

interface WebhookPayload {
  username: string;
  embeds: Array<{
    title: string;
    color: number;
    fields: Array<{
      name: string;
      value: string;
      inline: boolean;
    }>;
    footer: {
      text: string;
    };
  }>;
}

function main(): Client {
  const tokens: string[] = Array.from({ length: 15 }, (_, i) => {
    // console.log(`Checking for TOKEN_${i + 1}`, process.env[`TOKEN_${i + 1}`]);

    return process.env[`TOKEN_${i + 1}`];
  }).filter(
    (token): token is string => typeof token === "string" && token.length > 0
  );

  if (tokens.length === 0) {
    console.error(
      chalk.red.bold(
        "❌ No tokens found. Please set at least one TOKEN_X environment variable (e.g., TOKEN_1) in your .env file or environment."
      )
    );
    process.exit(1);
  }

  let currentTokenIndex: number = 0;

  const client: Client = new Client({
    checkUpdate: false,
    intents: 3276799,
  } as any);

  async function EnsureFiles(guild_id: string): Promise<unknown> {
    const G_Path: string = path.join(__dirname, "guilds");
    if (!fs.existsSync(G_Path)) {
      fs.mkdirSync(G_Path, { recursive: true });

      console.log(chalk.yellow.bold(`🔁 Created directory: ${G_Path}`));
    }

    const guildPath: string = path.join(G_Path, guild_id);

    if (!fs.existsSync(guildPath)) {
      fs.mkdirSync(guildPath, { recursive: true });
      console.log(chalk.yellow.bold(`🔁 Created directory: ${guildPath}`));
    } else {
      fs.readdirSync(guildPath).forEach((file: string) => {
        fs.unlinkSync(path.join(guildPath, file));
      });

      console.log(chalk.yellow.bold(`🔁 Cleared directory: ${guildPath}`));
    }

    return Sleep(1000);
  }

  async function ScrapeGuild(guild_id: string): Promise<void> {
    try {
      const guildObj: Guild = await client.guilds.fetch(guild_id);
      if (!guildObj) {
        console.log(
          chalk.yellow(
            `⚠️ Guild ${guild_id} no longer exists or is inaccessible.`
          )
        );
        return;
      }

      const db = new Database(
        path.join(__dirname, "guilds", guild_id, "database.json")
      );
      const members: Collection<string, GuildMember> =
        //@ts-expect-error Cache is not available in selfbot
        await guildObj.members.fetch({ limit: 1, cache: true });

      const memberIds: string[] = [];
      const memberData: MemberData[] = [];

      for (const member of members.values()) {
        if (member.user.id && !member.user.bot) {
          memberIds.push(member.user.id);

          const roleNames: string[] = member.roles.cache
            .filter((role) => role.name !== "@everyone")
            .map((role) => role.name);

          memberData.push({
            id: member.user.id,
            roles: roleNames,
          });
        }
      }

      db.set("id", memberIds);
      db.set("members", memberData);

      const timeout: number = 1000 * 22.5;

      console.log(
        `${chalk.blue("🔍 Scraped")} ${chalk.cyan(
          memberIds.length
        )} ${chalk.blue("members from guild")} ${chalk.yellow(
          guildObj.name
        )} (${guild_id})`
      );
      console.log(`${chalk.gray(`⏳ Waiting ${timeout / 1000} seconds...`)}\n`);

      await Sleep(timeout);
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        chalk.red(`❌ Failed to scrape guild ${guild_id}: ${errorMessage}`)
      );
    }
  }

  async function SendToDiscord(
    newUsers: number,
    updatedUsers: number
  ): Promise<void> {
    const webhookURL: string | undefined = process.env.WEBHOOK_URL;
    if (!webhookURL) {
      console.log(
        chalk.red("❌ Webhook URL is missing. Set it in your .env file.")
      );
      return;
    }

    const list: string = path.join(__dirname, "..", "..", "data", "list.json");
    if (!fs.existsSync(list)) {
      console.log(chalk.red("❌ compiledData.json not found!"));
      return;
    }

    const rawData: string = fs.readFileSync(list, "utf8");
    const data: CompiledData = JSON.parse(rawData);

    const totalUsers: number = Object.keys(data).length;

    const guilds: GuildsMap = {};
    for (const userId in data) {
      const guildEntries: string[] = data[userId];
      for (const entry of guildEntries) {
        const [guildId, guildName]: string[] = entry.split(":");
        if (!guilds[guildId]) {
          guilds[guildId] = { name: guildName, users: new Set() };
        }
        guilds[guildId].users.add(userId);
      }
    }

    const totalGuilds: number = Object.keys(guilds).length;
    const sortedGuilds: Array<[string, GuildData]> = Object.entries(guilds)
      .sort((a, b) => b[1].users.size - a[1].users.size)
      .slice(0, 5);

    const guildsMessage: string = sortedGuilds
      .map(
        ([guildId, guildData]: [string, GuildData], index: number) =>
          `**${index + 1}.** 🏠 **${guildData.name}** (${guildId}): **${
            guildData.users.size
          }** users`
      )
      .join("\n");

    const payload: WebhookPayload = {
      username: "Data Scraper",
      embeds: [
        {
          title: "📊 Scraping Stats",
          color: 3447003,
          fields: [
            { name: "👥 Total Users", value: `${totalUsers}`, inline: true },
            { name: "🏰 Total Guilds", value: `${totalGuilds}`, inline: true },
            { name: "\u200B", value: "\u200B", inline: true },

            { name: "🆕 New Users Added", value: `${newUsers}`, inline: true },
            {
              name: "♻️ Users Updated",
              value: `${updatedUsers}`,
              inline: true,
            },
            { name: "\u200B", value: "\u200B", inline: true },

            {
              name: "📊 Top 5 Guilds (by users)",
              value: guildsMessage || "No data",
              inline: false,
            },
          ],
          footer: {
            text: `Data compiled at ${new Date().toLocaleString()}`,
          },
        },
      ],
    };

    try {
      await fetch(webhookURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log(chalk.green("🚀 Stats sent to Discord webhook!"));
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : "Unknown error";
      console.error(chalk.red("❌ Failed to send webhook:"), errorMessage);
    }
  }

  async function CompileData(client: Client): Promise<void> {
    const guildsDir: string = path.join(__dirname, "guilds");
    const compiledDataPath: string = path.join(
      __dirname,
      "..",
      "..",
      "data",
      "list.json"
    );
    const rolesDataPath: string = path.join(
      __dirname,
      "..",
      "..",
      "data",
      "roles.json"
    );

    let compiledData: CompiledData = {};
    let rolesData: { [userId: string]: { [guildId: string]: string[] } } = {};

    if (fs.existsSync(compiledDataPath)) {
      compiledData = JSON.parse(fs.readFileSync(compiledDataPath, "utf-8"));
    }

    if (fs.existsSync(rolesDataPath)) {
      rolesData = JSON.parse(fs.readFileSync(rolesDataPath, "utf-8"));
    }

    const guildDirs: string[] = fs
      .readdirSync(guildsDir)
      .filter((file: string) =>
        fs.statSync(path.join(guildsDir, file)).isDirectory()
      );

    let newUsersCount: number = 0;
    let updatedUsersCount: number = 0;
    const IgnoredServers: string[] = [];

    for (const guild of guildDirs) {
      const db = new Database(path.join(guildsDir, guild, "database.json"));
      const memberIds: string[] = db.get("id") || [];
      const memberData: MemberData[] = db.get("members") || [];

      for (const memberId of memberIds) {
        if (config.ignoredUsers.includes(memberId)) continue;

        let guildObj: Guild | null = null;
        try {
          if (!IgnoredServers.includes(guild)) {
            guildObj = await client.guilds.fetch(guild);
          }
        } catch (error: unknown) {
          const errorMessage: string =
            error instanceof Error ? error.message : "Unknown error";
          console.error(chalk.red(`❌ ${guild}: ${errorMessage}`));
          IgnoredServers.push(guild);
          continue;
        }

        if (!guildObj) {
          continue;
        }

        const guildEntry: string = `${guild}:${guildObj.name}`;

        if (!compiledData[memberId]) {
          compiledData[memberId] = [guildEntry];
          newUsersCount++;
        } else {
          const existingGuildIds: string[] = compiledData[memberId].map(
            (entry: string) => entry.split(":")[0]
          );

          if (!existingGuildIds.includes(guild)) {
            compiledData[memberId].push(guildEntry);
            updatedUsersCount++;
          }
        }

        const memberRoleData = memberData.find((m) => m.id === memberId);
        if (memberRoleData && memberRoleData.roles.length > 0) {
          if (!rolesData[memberId]) {
            rolesData[memberId] = {};
          }
          rolesData[memberId][guild] = memberRoleData.roles;
        }
      }
    }

    fs.writeFileSync(compiledDataPath, JSON.stringify(compiledData, null, 2));
    fs.writeFileSync(rolesDataPath, JSON.stringify(rolesData, null, 2));

    console.log(chalk.green.bold("\n✅ Data compilation complete."));
    console.log(
      `🆕 ${chalk.cyan("New users added:")} ${chalk.green(newUsersCount)}`
    );
    console.log(
      `♻️ ${chalk.cyan("Users updated:")} ${chalk.yellow(updatedUsersCount)}`
    );

    await SendToDiscord(newUsersCount, updatedUsersCount);
  }

  async function loginWithToken(index: number): Promise<void> {
    const token: string | undefined = tokens[index];
    if (!token) {
      console.error(
        chalk.red.bold("❌ No valid token found at index " + index)
      );
      process.exit(1);
    }
    try {
      await client.login(token);
      console.log(chalk.green.bold(`[🔑] Logged in with token #${index + 1}`));
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        chalk.red(`❌ Failed to login with token: ${errorMessage}`)
      );
      process.exit(1);
    }
  }

  async function switchToken(): Promise<void> {
    try {
      await client.destroy();
    } catch (e: unknown) {
      console.error(e);
    }
    currentTokenIndex = (currentTokenIndex + 1) % tokens.length;
    await loginWithToken(currentTokenIndex);
  }

  client.on("ready", async (): Promise<void> => {
    console.log(
      chalk.green.bold(`[✅ Ready] Logged in as ${client.user!.tag}\n`)
    );

    while (true) {
      const totalGuilds: number = config.guilds.length;
      let processedGuilds: number = 0;

      for (const guildId of config.guilds) {
        try {
          const guild: Guild = await client.guilds.fetch(guildId);
          if (!guild) {
            console.log(
              chalk.yellow(
                `⚠️ Guild ${guildId} no longer exists or is inaccessible.`
              )
            );
            continue;
          }

          await EnsureFiles(guild.id);

          console.log(chalk.blue.bold(`🔁 Scraping guild ${guildId}...`));

          await ScrapeGuild(guild.id);

          processedGuilds++;
          const progress: string = (
            (processedGuilds / totalGuilds) *
            100
          ).toFixed(2);
          console.log(
            chalk.green.bold(
              `✅ Successfully scraped guild ${guildId} (${progress}% done)`
            )
          );
        } catch (error: unknown) {
          const errorMessage: string =
            error instanceof Error ? error.message : "Unknown error";
          console.error(
            chalk.red(`❌ Error processing guild ${guildId}: ${errorMessage}`)
          );
          console.log(
            chalk.yellow(
              "⏳ Waiting 10 seconds before continuing to the next guild..."
            )
          );
          await Sleep(10 * 1000);
        }
      }

      console.log(chalk.blue.bold(`\n🔁 Starting data compilation...\n`));
      await CompileData(client);

      await switchToken();

      const SleepTime: number = 60000 * 15;
      console.log(
        chalk.blue.bold(
          `\n🔁 Cycle completed. Waiting ${
            SleepTime / 60000
          } Minute(s) before restarting...\n`
        )
      );
      await Sleep(SleepTime);
    }
  });

  loginWithToken(currentTokenIndex);

  (global as any).discordClient = client;

  return client;
}

async function init() {
  const overwriteFiles = [
    "ClientUserSettingManager.js",
    "GuildMemberManager.js",
  ];

  for (const file of overwriteFiles) {
    const filePath = path.join(
      process.cwd(),
      "node_modules",
      "discord.js-selfbot-v13",
      "src",
      "managers",
      file
    );
    const overwritePath = path.join(__dirname, "..", "data", "overwrite", file);

    if (existsSync(filePath) && existsSync(overwritePath)) {
      try {
        const overwriteCode = await fs.promises.readFile(
          overwritePath,
          "utf-8"
        );
        await fs.promises.writeFile(filePath, overwriteCode, {
          encoding: "utf-8",
        });

        console.log(chalk.green(`✅ Overwrote ${file} successfully.`));
      } catch (err) {
        console.error(chalk.red(`❌ Failed to overwrite ${file}: ${err}`));
      }
    } else {
      console.warn(chalk.yellow(`⚠️ File ${file} not found for overwriting.`));
    }
  }

  return main();
}

init();
