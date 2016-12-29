---
layout: post
title: Snail Shells
description: Our command-line environments aren't built for productivity. Let's fix that.
---

Hello, reader mine! Today, I'm on a train back to the north to see my family for the holidays, which gives me the perfect opportunity to write about a conversation I had yesterday: **why are terminals so damn unusable?**

Now, understand what I mean here. Maybe we know our `ls` from our `ps`, and we know that we can _usually_ rely on `tar xvfz` (or some variation thereupon) to unzip our archives:  it's not _impossible_ to use a terminal, but it is a lot less straightforward than it should be. In this post, I'm going to moan about a few things, and hopefully suggest ways to improve them. So, let's get cracking:

## Down with Flags

First of all, I'd like to have a good moan _about_ `ls`, `ps`, `tar`, and all these commands that we use every day. I understand that these aren't _inherently_ part of the shell, but they certainly make up a sizeable chunk of our command-line interactions. Within these interactions, flags are, without a doubt, the worst part of it.

Why? Because **flags fundamentally change the behaviour of the programs**. If you're the sort of person who needs buzzwords assigned to arguments, put this under the **single responsibility principle**. Let's take a look at a pretty _good_ example of a small utility program: `wc`.

`wc` is short for `word count`. Pretty straightforward, apart from the fact that **it doesn't count words**. With no flags, it prints four values, _one of which_ is the number of words in the input. To get it to do exactly the thing its name would suggest, you want `wc -w`: _you need a flag to get the program to do what it is intuitively supposed to do_. However, it doesn't stop there:

- `-c` will count the number of **bytes** (_not_ characters, despite the letter used).
- `-m` will count the number of **characters** (why `m`?).
- `-l` will count the number of **lines**.

Set aside the poor choice of letters for a moment, and look at the third flag: in almost all my uses of `wc`, I have used the `-l` flag. The incredibly common task of counting lines of input is achieved through `wc -l`, a program with a flag that entirely changes its functionality.

Another issue with flags is that they inevitably give rise to several ways of achieving **the same thing**. For example, if we actually wanted to count the number of bytes within a file, it's probably _as_ common to use `ls -l` and parse the output with something like `awk`. Think about this: to get the size of a particular file, we can either use a program to count the words within a file, or a program to list the files within a directory. **Neither of these things do what we want**. This makes it really difficult for newcomers to build up an intuition about how to use the terminal: there is a _massive_ amount of cognitive load involved with even the simplest actions performed within the terminal.

### Alternative: Separated and Well-Named Functions

If you've been writing code for some amount of time, you've probably come across the issues around [overly complex `if` branching](http://degoes.net/articles/destroy-all-ifs): it makes our functions difficult to test, and it makes them much less intuitive. So, instead of a function with a **mysterious boolean** flag, we tend to write two functions with better names to describe the options separately. Let's apply that thinking to the terminal.

Instead of `wc -cmlw`, let's introduce four command-line utilities: `wordcount`, `linecount`, `charcount` (maybe even `charactercount`!), and `filesize`. These programs _exactly_ describe their behaviour, and need no flags at all. Not only does that mean much less configuration for the user to remember, but it means that we can simplify _other_ commands like `ls`: we have no need of the _option_ to display file sizes if we can do it simply with our `filesize` program!

Of course, what we'd quickly find is that a program with `n` mutually-exclusive flags becomes `2 ^ n` programs, which would certainly result in a _massive_ number of programs to encompass the behaviours of things like `tar`, but we'll see later how we could actually use a special _type_ of command-line utility to _compose_ smaller tools to make general-purpose behaviour.

Anyway, for now, we can dream of a day when we can find the longest line in a file (for, say, a code linter) with...

```
cat myfile | maximumWith lineLength
```

... rather than ...

```
cat myFile |
  awk '{ print length, $0 }' |
  sort -nr | head -1 |
  awk '{ for (i=2; i<= NF; i++) print $i }'
```

If `maximumWith` looks a bit odd, we'll talk about what it would mean in a little while. As for the comparison, I'm obliged to say you can actually use `wc -L myfile` on certain GNU/Linux distros.

... **Exactly**.

## Pruning Branches

Let's take a relatively simple problem: finding the average length of the lines in an input. We can write a "relatively simple" `awk` command to do this:

```
awk '{ len = length($0); total += len} END { print total / len }'
```

This is _fine_, and it's efficient, and whatever, but... it's relying on a command that is **Turing complete**. We want our pipelines to be like Lego - just a collection of little building blocks that we stick together to form the functionality we need, rather than an _entire_ programming language.

Fact is, we usually find our one-liner gets to a point of complexity (pretty quickly) that becomes more effort than just writing a script in something like Python or Perl. In which case, what does `awk` - _another scripting language_ - really give us except a slightly more obfuscated Perl? (Ok, that might be a bit too harsh...)

### Alternative: Higher-Order commands

Wouldn't we rather write things like this?

```
combineWith divide [ linelength | sumtotal ] [ linecount ]
```

This would introduce a couple of unseen features to the terminal: firstly, the `*With` functions. We have `combineWith` and `forEach`, and we had `maximumWith` earlier on. These are what we may already know as **higher-order** commands: commands that take other commands as parameters.

- `combineWith` takes **three** commands, `f`, `g`, and `h`, applies `g` and `h` (independently) to the input, then passes those two results to `f`. In this instance, we simultaneously `sum` the `lineLength` of each line **and** `linecount` the input, then `divide` the sum by the count to get the average!

- `maximumWith` takes a command, `f`, and then returns the line that is `greatest` when passed as the argument to `f`. In our earlier example, that meant returning the line that had the "greatest" `lineLength`.

We call these **higher-order commands** because they're pretty much a direct port from **higher-order functions** in programming: commands that accept commands as input. This adds a whole new level to command composition!

With this, we **remove** the need for probably-Turing-complete commands like `awk` and `sed`, because we have enough expression within our higher-order commands to group together much simpler tasks like `replace`, `sort`, and `substr`. We also remove the need for a _lot_ of the flags within our most common utility programs, because flags tend to allow us access to all kinds of data is so that we can **"jump" values over** certain steps in the pipeline.

If you don't believe me, write a program to print a list of files and their sizes _without_ using `ls` - in fact, say you can _only_ use `wc -c`. The problem is that `wc` doesn't output the file name, and you then need it to print alongside the filesize.

So, we currently use `ls -l` and pull the relevant data from the table. If we had these higher-order commands, there would be no need for most of the functionality within `ls`, as it could be brought in from other functions (e.g. `ls | combineWith echo [ cat ] [wc -c ]`).

I've introduced some new syntax, but it should be fairly straightforward: _to any shell purists, pls no h8_.

**Higher-order command composition reduces complexity**. This is how we get around the `2 ^ n` command problem: most of a program's flags are to retain information that would be lost in the pipeline. If we can create these parallel branches, we remove the _need_ for this retention. If you don't like the idea of a program called `combineWith`, might I suggest syntactical operators? I'm partial to `<*>`, myself. _\*cough\*_

## It Takes `2>&1` to Tango

Streams are _really_ cool. The first time you use `stderr`/`stdout` independently, it feels a little magical. Of course, this is also one of the few places where you can _actually_ do branching well (although convergence is not so simple...)

In what is probably the most controversial proposal of this post, I would like to suggest something radical: **unlimited streams**. Right now, we have two for writing and one for reading; why couldn't we add more?

Sometimes, I have two types of output, neither of which are errors. To give a recent example, perhaps I have a command to check that a list of **calendar dates** for those over two weeks old. I might want to output those that _are_ to one stream, those that _aren't_ to another, and formatting errors to `stderr`. Right now, I'm rather stuck... I'll probably end up writing a little script that does the split and the subsequent logic _for_ me, but that's inelegant, and another loss for the shell. Couldn't we do better?

```
cat dates | splitDates 2> ./errors 3> ./wins 4> ./losses
```

There are many use cases for this: we could establish **multiple error streams** to handle different levels of error (from `debug` to `fatal`), **multiple input streams** to handle different sources (we could `diff` two streams!), and all sorts of other goodies.

The point is that, when we need to do something more complicated than the three-stream system allows, we reach for a scripting language. This is a feature that our shell could support (albeit with _massive_ historical upset, of course...)

## Closing

I can never remember whether I want `df`, `du`, or `dd`. When do I `dd` _vs_ `scp` _vs_ `rsync` _vs_ `cp`? What's that `rsync` flag that prints the shiny progress bar? There are a lot of barriers to entry for the terminal that accompany its legacy.

Let's not worsen the situation with cryptic flags, mysterious syntaxes, and outdated restrictions. Why should we _emulate_ a terminal when we could produce something so much easier to use, while simultaneously much more capable? These features would bring a much-needed **usability boost** to the terminal, and maybe save a dev or two from an afternoon of **hacking in Perl**.

For me, that would be its own reward.

---

Thanks for reading! Feel absolutely free to comment, tweet, or _whatever_ me if you disagree with anything - or, even better, if you actually know how to accomplish these things currently! - and we'll talk it out. I'd love to hear your opinions.

_With that, I should probably apologise to [m'colleague](https://twitter.com/justnine) who probably wasn't expecting Perl-bashing when he agreed to read this. (Sorry!)_

Take care &hearts;
