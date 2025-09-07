export const FxManifestMock = `
fx_version "cerulean"
game "gta5"
lua54 "yes"
node_version "22"

author "Loaf Scripts"
description "A script to automatically restart FiveM scripts when the files are saved/changed."

shared_script "shared/*.lua"
client_script "client/*.lua" 
server_script "server/dist/index.js"

client_scripts {
    "client/*.lua", 
    "client/somefile.lua",
    "client/someotherfile.lua",
}

server_scripts {
    "server/*.lua",
    "server/somefile.lua",
    "server/someotherfile.lua",
}

shared_script("shared/*.lua")
client_script("client/*.lua")
server_script("server/dist/index.js")

client_scripts({
    "client/*.lua",
    "client/somefile.lua",
    "client/someotherfile.lua",
})

server_scripts({
    "server/*.lua",
    "server/somefile.lua",
    "server/someotherfile.lua",
})

files {
    "html/index.html",
    "html/script.js",
    "html/style.css",
    "html/images/*.png",
}

file "config.json"
`;
