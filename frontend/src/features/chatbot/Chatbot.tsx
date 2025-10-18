import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { aiApi } from "@/services/api";
import ReactMarkdown from "react-markdown";

interface Message {
	role: "user" | "assistant";
	content: string;
}

export default function Chatbot({ onClose }: { onClose: () => void }) {
	const [messages, setMessages] = useState<Message[]>([
		{
			role: "assistant",
			content:
				"Hi! I can help you analyze fuel surcharge data. What would you like to know?",
		},
	]);
	const [input, setInput] = useState("");
	const [loading, setLoading] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	const handleSend = async () => {
		if (!input.trim() || loading) return;

		const userMessage = { role: "user" as const, content: input };
		setMessages((prev) => [...prev, userMessage]);
		setInput("");
		setLoading(true);

		try {
			const response = await aiApi.chat(input, messages);
			setMessages((prev) => [
				...prev,
				{
					role: "assistant",
					content: response.data.message,
				},
			]);
		} catch (error) {
			setMessages((prev) => [
				...prev,
				{
					role: "assistant",
					content: "Sorry, I encountered an error. Please try again.",
				},
			]);
		} finally {
			setLoading(false);
		}
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: 20 }}
			className="fixed bottom-24 right-6 w-96 h-[500px] glass dark:glass-dark rounded-2xl shadow-2xl flex flex-col z-50"
		>
			{/* Header */}
			<div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gradient-ups text-white rounded-t-2xl">
				<div>
					<h3 className="font-semibold">UPS Surcharge Assistant</h3>
					<p className="text-xs opacity-80">Ask about fuel surcharges</p>
				</div>
				<button
					onClick={onClose}
					className="p-1 hover:bg-white/20 rounded transition-colors"
					aria-label="Close chatbot"
				>
					<X className="w-5 h-5" />
				</button>
			</div>

			{/* Messages */}
			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				{messages.map((message, idx) => (
					<motion.div
						key={idx}
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						className={`flex ${
							message.role === "user" ? "justify-end" : "justify-start"
						}`}
					>
						<div
							className={`max-w-[80%] p-3 rounded-lg text-sm ${
								message.role === "user"
									? "gradient-ups text-white"
									: "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
							}`}
						>
							<ReactMarkdown
								components={{
									p: ({ node, ...props }) => (
										<p className="mb-2 last:mb-0" {...props} />
									),
									ul: ({ node, ...props }) => (
										<ul className="list-disc ml-4 mb-2" {...props} />
									),
									ol: ({ node, ...props }) => (
										<ol className="list-decimal ml-4 mb-2" {...props} />
									),
									li: ({ node, ...props }) => (
										<li className="mb-1" {...props} />
									),
									code: ({ node, inline, ...props }: any) =>
										inline ? (
											<code
												className="bg-gray-800/50 px-1 rounded text-xs"
												{...props}
											/>
										) : (
											<code
												className="block bg-gray-800/50 p-2 rounded text-xs my-2"
												{...props}
											/>
										),
									strong: ({ node, ...props }) => (
										<strong className="font-bold" {...props} />
									),
									em: ({ node, ...props }) => (
										<em className="italic" {...props} />
									),
								}}
							>
								{message.content}
							</ReactMarkdown>
						</div>
					</motion.div>
				))}
				{loading && (
					<div className="flex justify-start">
						<div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
							<Loader2 className="w-4 h-4 animate-spin" />
						</div>
					</div>
				)}
				<div ref={messagesEndRef} />
			</div>

			{/* Input */}
			<div className="p-4 border-t border-gray-200 dark:border-gray-700">
				<div className="flex gap-2">
					<input
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyPress={handleKeyPress}
						placeholder="Ask a question..."
						className="flex-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
						disabled={loading}
					/>
					<Button
						onClick={handleSend}
						disabled={!input.trim() || loading}
						size="sm"
						className="px-3"
					>
						<Send className="w-4 h-4" />
					</Button>
				</div>
			</div>
		</motion.div>
	);
}
