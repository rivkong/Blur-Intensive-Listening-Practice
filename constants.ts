import { Material } from './types';

// Using a public domain audio sample for the demo, or simulating it.
// Since we can't reliably hotlink arbitrary MP3s, we will simulate the "playing" state with a timer if the audio fails,
// but let's try to map to a standard speech sample structure.

export const MOCK_MATERIALS: Material[] = [
  {
    id: '1',
    title: 'The Art of Silence',
    description: 'An exploration of why silence is crucial for modern creativity and mental health.',
    category: 'Psychology',
    difficulty: 'Medium',
    duration: '1:45',
    imageUrl: 'https://picsum.photos/seed/silence/800/600',
    audioUrl: 'https://www2.cs.uic.edu/~i101/SoundFiles/StarWars3.wav', // Just a placeholder sound for demo mechanics
    segments: [
      { id: 's1', startTime: 0, endTime: 4, text: "In a world that never stops talking, silence has become a rare commodity." },
      { id: 's2', startTime: 4, endTime: 9, text: "We interpret silence as emptiness, a void that needs to be filled with noise, notifications, and chatter." },
      { id: 's3', startTime: 9, endTime: 14, text: "However, true silence is not the absence of sound, but the presence of focus." },
      { id: 's4', startTime: 14, endTime: 19, text: "Neuroscientists have found that spending time in silence can actually regenerate brain cells in the hippocampus." },
      { id: 's5', startTime: 19, endTime: 24, text: "This is the region of the brain responsible for memory, emotion, and learning." },
      { id: 's6', startTime: 24, endTime: 30, text: "When we constantly bombard our brains with sensory input, we deny it the processing time it requires." },
      { id: 's7', startTime: 30, endTime: 35, text: "Just as muscles need rest after exercise, the mind needs stillness after stimulation." },
      { id: 's8', startTime: 35, endTime: 42, text: "Embracing silence allows us to hear our own thoughts clearly, distinguishing them from the noise of society." },
      { id: 's9', startTime: 42, endTime: 48, text: "It is in these quiet moments that our deepest insights and most creative ideas are often born." },
      { id: 's10', startTime: 48, endTime: 55, text: "So, the next time you feel the urge to fill the silence, try simply listening to it instead." }
    ]
  },
  {
    id: '4',
    title: 'How to Manage Stress',
    description: 'Tara Sorenson, a public health nurse, explains the science of stress and how to convert it into a positive force.',
    category: 'Health',
    difficulty: 'Medium',
    duration: '3:45',
    imageUrl: 'https://picsum.photos/seed/stress_management/800/600',
    audioUrl: '', // Simulation mode
    segments: [
      { id: 't1', startTime: 0, endTime: 12, text: "Hello everyone, and thanks for coming. I'd like to introduce myself. I'm Tara Sorenson, and I'm a public health nurse." },
      { id: 't2', startTime: 12, endTime: 25, text: "Public health nurses are like other nurses, but we take care of more than one person. Our job is to keep everyone in the community healthy. I know, it's a big job." },
      { id: 't3', startTime: 25, endTime: 40, text: "Mostly, I do this through education. Tonight, I'm going to talk with you about stress and how to manage it. I hope to provide information that will help all of you to live longer, healthier lives." },
      { id: 't4', startTime: 40, endTime: 55, text: "Before I talk about managing stress, however, let's think about what causes stress and also about the way stress feels. We all have some stress in our lives, right? Whether it is school work, or our jobs, or raising children." },
      { id: 't5', startTime: 55, endTime: 70, text: "These things keep us very busy, and sometimes we feel like it is all too much. In other words, life can make us feel stressed out. Our hearts beat faster, and our breathing changes." },
      { id: 't6', startTime: 70, endTime: 82, text: "We might have a headache or stomach problems. Another important topic is the effects of stress. It certainly can be harmful to our health." },
      { id: 't7', startTime: 82, endTime: 95, text: "For example, people who have a lot of stress in their lives can develop high blood pressure. That makes the heart work harder, and it can lead to different health problems." },
      { id: 't8', startTime: 95, endTime: 110, text: "People might not eat well, or might not sleep well, and that can also cause problems. On the other hand, stress can be helpful, too." },
      { id: 't9', startTime: 110, endTime: 125, text: "One health psychologist, her name is Kelly McGonigal, says that stress helps us to do difficult or challenging things. And according to McGonigal, we can be healthier if we think of stress as helpful to us." },
      { id: 't10', startTime: 125, endTime: 140, text: "Something that gives us extra energy to meet challenges. It's an interesting idea, isn't it? If you think that stress is helping you, it's less likely to hurt you." },
      { id: 't11', startTime: 140, endTime: 155, text: "So your attitude about stress is pretty important. Okay, my last point is about managing stress." },
      { id: 't12', startTime: 155, endTime: 170, text: "Since stress can be harmful to the body, let's talk about some ways to prevent these health problems. These are things you can do every day, or at least most of the time. I know, none of us are perfect, are we?" },
      { id: 't13', startTime: 170, endTime: 185, text: "One very good way to manage stress is by getting enough exercise. I recommend exercising at least four or five days a week, for at least 30 minutes. You can walk, or run, or play a sport." },
      { id: 't14', startTime: 185, endTime: 200, text: "In fact, any kind of exercise can become a healthy habit for dealing with stress if you do it often. Of course, it's also important to get enough sleep, eat a healthy diet, and find time to connect socially." },
      { id: 't15', startTime: 200, endTime: 215, text: "To communicate and spend time with our friends and family members. Listen to music, take a yoga class, or find another way to relax." },
      { id: 't16', startTime: 215, endTime: 225, text: "And remember, when you do feel stress, you should try to keep a positive attitude about it. Think of stress as something that can be helpful, and don't let stress prevent you from living a healthy life." }
    ]
  },
  {
    id: '2',
    title: 'The Future of AI',
    description: 'Understanding how large language models function and their impact on daily workflow.',
    category: 'Technology',
    difficulty: 'Hard',
    duration: '2:10',
    imageUrl: 'https://picsum.photos/seed/ai/800/600',
    audioUrl: '', 
    segments: [
      { id: 'a1', startTime: 0, endTime: 5, text: "Artificial Intelligence has transitioned from science fiction to everyday reality in less than a decade." },
      { id: 'a2', startTime: 5, endTime: 12, text: "Large Language Models, or LLMs, work by predicting the probability of the next word in a sequence." },
      { id: 'a3', startTime: 12, endTime: 18, text: "This simple mechanism, when scaled with massive data, produces emergent behaviors that mimic reasoning." },
      { id: 'a4', startTime: 18, endTime: 25, text: "However, it is crucial to remember that these models do not 'know' facts in the way humans do." },
      { id: 'a5', startTime: 25, endTime: 32, text: "They operate on patterns, correlations, and statistical likelihoods." }
    ]
  },
  {
    id: '3',
    title: 'Morning Routines',
    description: 'How the first hour of your day determines your productivity and mood.',
    category: 'Lifestyle',
    difficulty: 'Easy',
    duration: '1:15',
    imageUrl: 'https://picsum.photos/seed/morning/800/600',
    audioUrl: '',
    segments: [
      { id: 'm1', startTime: 0, endTime: 6, text: "The way you start your morning can set the tone for the entire day." },
      { id: 'm2', startTime: 6, endTime: 12, text: "Avoiding your phone for the first thirty minutes helps reduce cortisol levels." },
      { id: 'm3', startTime: 12, endTime: 18, text: "Hydration is equally important, as the body loses water during sleep." }
    ]
  }
];