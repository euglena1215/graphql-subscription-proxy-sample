import { ApolloServer, gql, PubSub } from "apollo-server";
import { client as WebSocketClient } from "websocket";

const SEND_CHAT = "SEND_CHAT";
const WS_SEND_CHAT = "WS_SEND_CHAT";

const pubsub = new PubSub();
const wsPubsub = new PubSub();

// The GraphQL schema
const typeDefs = gql`
  type Chat {
    handle: String
    text: String
  }
  type Query {
    ping: String
  }

  type Mutation {
    sendChat(handle: String, text: String): Chat
  }

  type Subscription {
    sentChat: Chat
  }
`;

// A map of functions which return data for the schema.
const resolvers = {
  Query: {
    ping: () => "pong",
  },
  Mutation: {
    sendChat: (root: any, args: any) => {
      wsPubsub.publish(WS_SEND_CHAT, args);
      return args;
    },
  },
  Subscription: {
    sentChat: {
      subscribe: () => pubsub.asyncIterator(SEND_CHAT),
    },
  },
};

const client = new WebSocketClient();

client.on("connectFailed", function(error) {
  console.log("Connect Error: " + error.toString());
});

client.on("connect", function(connection) {
  console.log("WebSocket Client Connected");
  connection.on("error", function(error) {
    console.log("Connection Error: " + error.toString());
  });
  connection.on("close", function() {
    console.log("echo-protocol Connection Closed");
  });
  connection.on("message", function(message) {
    console.log(JSON.parse(message.utf8Data!));
    if (message.type === "utf8" && message.utf8Data) {
      console.log("Received: '" + message.utf8Data + "'");
      pubsub.publish(SEND_CHAT, JSON.parse(message.utf8Data));
    }
  });

  wsPubsub.subscribe(WS_SEND_CHAT, (args: { handle: string; text: string }) => {
    if (connection.connected) {
      connection.send(JSON.stringify(args));
    }
  });
});

client.connect("ws://localhost:5000/");

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

server.listen().then(({ url }: { url: any }) => {
  console.log(`🚀 Server ready at ${url}`);
});
