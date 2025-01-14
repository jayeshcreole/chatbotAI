import React, { Suspense, useState } from "react";
import { useCookies } from "react-cookie";
import "./chat.css";
import { SendOutlined } from "@ant-design/icons";
import { Configuration, OpenAIApi } from "openai";
/// creating the openai object for fetching completion
const configuration = new Configuration({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_KEY,
});
const openai = new OpenAIApi(configuration);

function Chat({ chatbot }: any) {
  const [cookies, setCookies] = useCookies(["userId"]);
  /// messages
  const [messages, setMessages] = useState(
    chatbot.initial_message == null
      ? [{ role: "assistant", content: `Hi! What can I help you with?` }]
      : [{ role: "assistant", content: chatbot.initial_message }]
  );

  /// storing the input value
  const [userQuery, setUserQuery] = useState("");

  /// chat base response
  const [response, setResponse] = useState("");

  /// loading state
  const [loading, setLoading] = useState(false);

  /// get the chatbase response
  async function getReply(event: any) {
    if (event.key === "Enter" || event === "click") {
      if (userQuery.trim() == "") {
        alert("Please enter the message");
      } else {
        /// clear the response
        setUserQuery("");
        /// set the user query
        setMessages((prev) => [...prev, { role: "user", content: userQuery }]);
        /// check which chatbot to interact with i.e. chatbase bot or custom bot
        const chatbotIdLength = chatbot?.id.length;
        if (chatbotIdLength !== 36) {
          const options = {
            method: "POST",
            headers: {
              accept: "application/json",
              "content-type": "application/json",
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTHORIZATION}`,
              cache: "no-store",
            },
            body: JSON.stringify({
              stream: true,
              temperature: 0,
              chatId: chatbot.id,
              messages: [...messages, { role: "user", content: userQuery }],
            }),
          };

          /// get the response from chatbase api
          let resptext = "";
          try {
            setLoading(true);
            const response: any = await fetch(
              "https://www.chatbase.co/api/v1/chat",
              options
            );
            // Read the response as a stream of data
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");

            /// decode the chunks
            while (true) {
              const { done, value } = await reader.read();

              if (done) {
                /// setting the response when completed
                setMessages((prev) => [
                  ...prev,
                  { role: "assistant", content: resptext },
                ]);
                setResponse("");
                break;
              }

              // Massage and parse the chunk of data
              const chunk = decoder.decode(value);
              resptext += chunk;
              setResponse(resptext);
            }

            if (!response.ok) {
              throw new Error(` when getting user query response `);
            }
          } catch (error) {
            console.log(error);
          } finally {
            setLoading(false);
          }
        } else {
          try {
            /// get similarity search
            const response: any = await fetch(
              `${process.env.NEXT_PUBLIC_WEBSITE_URL}api/pinecone`,
              {
                method: "POST",
                body: JSON.stringify({
                  userQuery,
                  chatbotId: chatbot?.id,
                  userId: cookies.userId,
                }),
              }
            );

            /// parse the response and extract the similarity results
            const respText = await response.text();
            const similaritySearchResults = JSON.parse(respText).join("\n");

            // Fetch the response from the OpenAI API
            const responseOpenAI: any = await fetch(
              "https://api.openai.com/v1/chat/completions",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_KEY}`,
                },
                body: JSON.stringify({
                  model: "gpt-3.5-turbo",
                  temperature: 0.5,
                  top_p: 1,
                  messages: [
                    {
                      role: "system",
                      content: `Use the following pieces of context to answer the users question.
              If you don't know the answer, just say that you don't know, don't try to make up an answer.
              ----------------
              ${similaritySearchResults}`,
                    },
                    // ...messages,
                    { role: "user", content: userQuery },
                  ],
                  stream: true,
                }),
              }
            );

            // Read the response as a stream of data
            let resptext = "";
            const reader = responseOpenAI.body.getReader();
            const decoder = new TextDecoder("utf-8");

            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                /// setting the response when completed
                setMessages((prev) => [
                  ...prev,
                  { role: "assistant", content: resptext },
                ]);
                setResponse("");
                break;
              }
              // Massage and parse the chunk of data
              const chunk = decoder.decode(value);
              const lines = chunk.split("\n");
              const parsedLines = lines
                .map((line) => line.replace(/^data: /, "").trim()) // Remove the "data: " prefix
                .filter((line) => line !== "" && line !== "[DONE]") // Remove empty lines and "[DONE]"
                .map((line, index) => JSON.parse(line)); // Parse the JSON string

              for (const parsedLine of parsedLines) {
                const { choices } = parsedLine;
                const { delta } = choices[0];
                const { content } = delta;
                // Update the UI with the new content
                if (content) {
                  resptext += content;
                  setResponse(resptext);
                }
              }
            }
            // console.log("Response.", model.data);
          } catch (e: any) {
            console.log(
              "Error while getting completion from custom chatbot",
              e.message
            );
          }
        }
      }
    }
  }

  return (
    <div className="chat-container">
      <div className="conversation-container">
        {messages.map((message, index) => {
          if (message.role == "assistant")
            return (
              <div className="assistant-message" key={index}>
                {message.content}
              </div>
            );
          else
            return (
              <div className="user-message" key={index}>
                {message.content}
              </div>
            );
        })}
        {response && <div className="assistant-message">{response}</div>}
      </div>
      <div className="chat-question">
        <input
          type="text"
          onKeyDown={getReply}
          onChange={(event) => {
            setUserQuery(event.target.value);
          }}
          value={userQuery}
        />
        <SendOutlined className="icon" onClick={() => getReply("click")} />
      </div>
    </div>
  );
}

export default Chat;
