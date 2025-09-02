"use strict";
/**
 * Discord Member Scraper
 *
 * Credits:
 * - John-online (https://github.com/John-online)
 * - SnepCnep (https://github.com/SnepCnep)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
require("dotenv/config");
const Sleep_1 = tslib_1.__importDefault(require("./utils/Sleep"));
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const discord_js_selfbot_v13_1 = require("discord.js-selfbot-v13");
const config_json_1 = tslib_1.__importDefault(require("../config.json"));
const node_path_1 = tslib_1.__importDefault(require("node:path"));
const node_fs_1 = tslib_1.__importStar(require("node:fs"));
const database_1 = tslib_1.__importDefault(require("./database"));
function main() {
    const tokens = Array.from({ length: 15 }, (_, i) => {
        // console.log(`Checking for TOKEN_${i + 1}`, process.env[`TOKEN_${i + 1}`]);
        return process.env[`TOKEN_${i + 1}`];
    }).filter((token) => typeof token === "string" && token.length > 0);
    if (tokens.length === 0) {
        console.error(chalk_1.default.red.bold("❌ No tokens found. Please set at least one TOKEN_X environment variable (e.g., TOKEN_1) in your .env file or environment."));
        process.exit(1);
    }
    let currentTokenIndex = 0;
    const client = new discord_js_selfbot_v13_1.Client({
        checkUpdate: false,
        intents: 3276799,
    });
    async function EnsureFiles(guild_id) {
        const G_Path = node_path_1.default.join(__dirname, "guilds");
        if (!node_fs_1.default.existsSync(G_Path)) {
            node_fs_1.default.mkdirSync(G_Path, { recursive: true });
            console.log(chalk_1.default.yellow.bold(`🔁 Created directory: ${G_Path}`));
        }
        const guildPath = node_path_1.default.join(G_Path, guild_id);
        if (!node_fs_1.default.existsSync(guildPath)) {
            node_fs_1.default.mkdirSync(guildPath, { recursive: true });
            console.log(chalk_1.default.yellow.bold(`🔁 Created directory: ${guildPath}`));
        }
        else {
            node_fs_1.default.readdirSync(guildPath).forEach((file) => {
                node_fs_1.default.unlinkSync(node_path_1.default.join(guildPath, file));
            });
            console.log(chalk_1.default.yellow.bold(`🔁 Cleared directory: ${guildPath}`));
        }
        return (0, Sleep_1.default)(1000);
    }
    async function ScrapeGuild(guild_id) {
        try {
            const guildObj = await client.guilds.fetch(guild_id);
            if (!guildObj) {
                console.log(chalk_1.default.yellow(`⚠️ Guild ${guild_id} no longer exists or is inaccessible.`));
                return;
            }
            const db = new database_1.default(node_path_1.default.join(__dirname, "guilds", guild_id, "database.json"));
            const members = 
            //@ts-expect-error Cache is not available in selfbot
            await guildObj.members.fetch({ limit: 1, cache: true });
            const memberIds = [];
            const memberData = [];
            for (const member of members.values()) {
                if (member.user.id && !member.user.bot) {
                    memberIds.push(member.user.id);
                    const roleNames = member.roles.cache
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
            const timeout = 1000 * 22.5;
            console.log(`${chalk_1.default.blue("🔍 Scraped")} ${chalk_1.default.cyan(memberIds.length)} ${chalk_1.default.blue("members from guild")} ${chalk_1.default.yellow(guildObj.name)} (${guild_id})`);
            console.log(`${chalk_1.default.gray(`⏳ Waiting ${timeout / 1000} seconds...`)}\n`);
            await (0, Sleep_1.default)(timeout);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error(chalk_1.default.red(`❌ Failed to scrape guild ${guild_id}: ${errorMessage}`));
        }
    }
    async function SendToDiscord(newUsers, updatedUsers) {
        const webhookURL = process.env.WEBHOOK_URL;
        if (!webhookURL) {
            console.log(chalk_1.default.red("❌ Webhook URL is missing. Set it in your .env file."));
            return;
        }
        const list = node_path_1.default.join(__dirname, "..", "..", "data", "list.json");
        if (!node_fs_1.default.existsSync(list)) {
            console.log(chalk_1.default.red("❌ compiledData.json not found!"));
            return;
        }
        const rawData = node_fs_1.default.readFileSync(list, "utf8");
        const data = JSON.parse(rawData);
        const totalUsers = Object.keys(data).length;
        const guilds = {};
        for (const userId in data) {
            const guildEntries = data[userId];
            for (const entry of guildEntries) {
                const [guildId, guildName] = entry.split(":");
                if (!guilds[guildId]) {
                    guilds[guildId] = { name: guildName, users: new Set() };
                }
                guilds[guildId].users.add(userId);
            }
        }
        const totalGuilds = Object.keys(guilds).length;
        const sortedGuilds = Object.entries(guilds)
            .sort((a, b) => b[1].users.size - a[1].users.size)
            .slice(0, 5);
        const guildsMessage = sortedGuilds
            .map(([guildId, guildData], index) => `**${index + 1}.** 🏠 **${guildData.name}** (${guildId}): **${guildData.users.size}** users`)
            .join("\n");
        const payload = {
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
            console.log(chalk_1.default.green("🚀 Stats sent to Discord webhook!"));
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error(chalk_1.default.red("❌ Failed to send webhook:"), errorMessage);
        }
    }
    async function CompileData(client) {
        const guildsDir = node_path_1.default.join(__dirname, "guilds");
        const compiledDataPath = node_path_1.default.join(__dirname, "..", "..", "data", "list.json");
        const rolesDataPath = node_path_1.default.join(__dirname, "..", "..", "data", "roles.json");
        let compiledData = {};
        let rolesData = {};
        if (node_fs_1.default.existsSync(compiledDataPath)) {
            compiledData = JSON.parse(node_fs_1.default.readFileSync(compiledDataPath, "utf-8"));
        }
        if (node_fs_1.default.existsSync(rolesDataPath)) {
            rolesData = JSON.parse(node_fs_1.default.readFileSync(rolesDataPath, "utf-8"));
        }
        const guildDirs = node_fs_1.default
            .readdirSync(guildsDir)
            .filter((file) => node_fs_1.default.statSync(node_path_1.default.join(guildsDir, file)).isDirectory());
        let newUsersCount = 0;
        let updatedUsersCount = 0;
        const IgnoredServers = [];
        for (const guild of guildDirs) {
            const db = new database_1.default(node_path_1.default.join(guildsDir, guild, "database.json"));
            const memberIds = db.get("id") || [];
            const memberData = db.get("members") || [];
            for (const memberId of memberIds) {
                if (config_json_1.default.ignoredUsers.includes(memberId))
                    continue;
                let guildObj = null;
                try {
                    if (!IgnoredServers.includes(guild)) {
                        guildObj = await client.guilds.fetch(guild);
                    }
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : "Unknown error";
                    console.error(chalk_1.default.red(`❌ ${guild}: ${errorMessage}`));
                    IgnoredServers.push(guild);
                    continue;
                }
                if (!guildObj) {
                    continue;
                }
                const guildEntry = `${guild}:${guildObj.name}`;
                if (!compiledData[memberId]) {
                    compiledData[memberId] = [guildEntry];
                    newUsersCount++;
                }
                else {
                    const existingGuildIds = compiledData[memberId].map((entry) => entry.split(":")[0]);
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
        node_fs_1.default.writeFileSync(compiledDataPath, JSON.stringify(compiledData, null, 2));
        node_fs_1.default.writeFileSync(rolesDataPath, JSON.stringify(rolesData, null, 2));
        console.log(chalk_1.default.green.bold("\n✅ Data compilation complete."));
        console.log(`🆕 ${chalk_1.default.cyan("New users added:")} ${chalk_1.default.green(newUsersCount)}`);
        console.log(`♻️ ${chalk_1.default.cyan("Users updated:")} ${chalk_1.default.yellow(updatedUsersCount)}`);
        await SendToDiscord(newUsersCount, updatedUsersCount);
    }
    async function loginWithToken(index) {
        const token = tokens[index];
        if (!token) {
            console.error(chalk_1.default.red.bold("❌ No valid token found at index " + index));
            process.exit(1);
        }
        try {
            await client.login(token);
            console.log(chalk_1.default.green.bold(`[🔑] Logged in with token #${index + 1}`));
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error(chalk_1.default.red(`❌ Failed to login with token: ${errorMessage}`));
            process.exit(1);
        }
    }
    async function switchToken() {
        try {
            await client.destroy();
        }
        catch (e) {
            console.error(e);
        }
        currentTokenIndex = (currentTokenIndex + 1) % tokens.length;
        await loginWithToken(currentTokenIndex);
    }
    client.on("ready", async () => {
        console.log(chalk_1.default.green.bold(`[✅ Ready] Logged in as ${client.user.tag}\n`));
        while (true) {
            const totalGuilds = config_json_1.default.guilds.length;
            let processedGuilds = 0;
            for (const guildId of config_json_1.default.guilds) {
                try {
                    const guild = await client.guilds.fetch(guildId);
                    if (!guild) {
                        console.log(chalk_1.default.yellow(`⚠️ Guild ${guildId} no longer exists or is inaccessible.`));
                        continue;
                    }
                    await EnsureFiles(guild.id);
                    console.log(chalk_1.default.blue.bold(`🔁 Scraping guild ${guildId}...`));
                    await ScrapeGuild(guild.id);
                    processedGuilds++;
                    const progress = ((processedGuilds / totalGuilds) *
                        100).toFixed(2);
                    console.log(chalk_1.default.green.bold(`✅ Successfully scraped guild ${guildId} (${progress}% done)`));
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : "Unknown error";
                    console.error(chalk_1.default.red(`❌ Error processing guild ${guildId}: ${errorMessage}`));
                    console.log(chalk_1.default.yellow("⏳ Waiting 10 seconds before continuing to the next guild..."));
                    await (0, Sleep_1.default)(10 * 1000);
                }
            }
            console.log(chalk_1.default.blue.bold(`\n🔁 Starting data compilation...\n`));
            await CompileData(client);
            await switchToken();
            const SleepTime = 60000 * 15;
            console.log(chalk_1.default.blue.bold(`\n🔁 Cycle completed. Waiting ${SleepTime / 60000} Minute(s) before restarting...\n`));
            await (0, Sleep_1.default)(SleepTime);
        }
    });
    loginWithToken(currentTokenIndex);
    global.discordClient = client;
    return client;
}
async function init() {
    const overwriteFiles = [
        "ClientUserSettingManager.js",
        "GuildMemberManager.js",
    ];
    for (const file of overwriteFiles) {
        const filePath = node_path_1.default.join(process.cwd(), "node_modules", "discord.js-selfbot-v13", "src", "managers", file);
        const overwritePath = node_path_1.default.join(__dirname, "..", "data", "overwrite", file);
        if ((0, node_fs_1.existsSync)(filePath) && (0, node_fs_1.existsSync)(overwritePath)) {
            try {
                const overwriteCode = await node_fs_1.default.promises.readFile(overwritePath, "utf-8");
                await node_fs_1.default.promises.writeFile(filePath, overwriteCode, {
                    encoding: "utf-8",
                });
                console.log(chalk_1.default.green(`✅ Overwrote ${file} successfully.`));
            }
            catch (err) {
                console.error(chalk_1.default.red(`❌ Failed to overwrite ${file}: ${err}`));
            }
        }
        else {
            console.warn(chalk_1.default.yellow(`⚠️ File ${file} not found for overwriting.`));
        }
    }
    return main();
}
init();
