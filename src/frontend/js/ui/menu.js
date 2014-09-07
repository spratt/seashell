"use strict";
/**
 * Seashell.
 * Copyright (C) 2013-2014 The Seashell Maintainers.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * See also 'ADDITIONAL TERMS' at the end of the included LICENSE file.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

function handleSaveProject() {
  return SeashellProject.currentProject.save();
}

function handleCompileProject() {
  return SeashellProject.currentProject.compile();
}

function handleRunProject() {
  return SeashellProject.run();
}

function handleRunTests() {
  return SeashellProject.runTests();
}

function handleProgramKill() {
  SeashellProject.currentProject.kill()
    .done(function() {
      setPlayStopButtonPlaying(false);
      editor.focus();
      consoleWriteln("# stopped by user (that's you!)");
    });
}

function handleDownloadProject() {
  SeashellProject.currentProject.getDownloadToken()
    .done(function(token) {
      $("#download-iframe").remove();
      var raw = JSON.stringify(token);
      var frame = $("<iframe>").attr("src",
        sprintf("https://%s:%s/export/%s.zip?token=%s",
          creds.host,
          creds.port,
          encodeURIComponent(SeashellProject.currentProject.name),
          encodeURIComponent(raw)))
        .attr("id", "download-iframe");
      $("#download-project-body").append(frame);
      $("#download-project-dialog").modal("show");
    });
}

function setPlayStopButtonPlaying(playing) {
  var a = '#toolbar-run', b = '#toolbar-kill';
  if (!playing)
    b = [a, a = b][0];
  $(a).addClass('hidden');
  $(b).removeClass('hidden');
}

function setupMenu() {
  function withInputFromConsole(x) {
    consoleClear();
    $('#input-line').focus();
    x();
  }

  $("#toolbar-run").on("click", function() {
    withInputFromConsole(handleRunProject);
  });
  $("#toolbar-run-tests").on("click", function() {
    withInputFromConsole(handleRunTests);
  });
  $("#toolbar-kill").on("click", handleProgramKill);
  $("#menu-download").on("click", handleDownloadProject);
  $('#toolbar-delete-file').on("click", function() {
    displayConfirmationMessage('delete file',
                               'are you sure you want to delete the current\
                               file?',
                  function() {
                    var file = SeashellProject.currentProject.currentFile;
                    if (!file.is_dir)
                      SeashellProject.currentProject.deleteFile(file)
                      .done(updateFileMenu);
                  });
  });

  $('#toolbar-add-file').on('click', showNewFileDialog);
  $('#toolbar-rename-file').on('click', showRenameMoveFileDialog);

  $('#toolbar-submit-question').on('click', function() {
    $('#marmoset-submit-dialog').modal('show');
  });
}

function updateFileMenu(proj)
{
  openQuestion(proj.currentQuestion);
}

function updateQuestionsMenu(proj, questions)
{
  $('#questions-row').empty();
  var links =
        _.map(questions, function(name) {
          var link = $('<a>', { href: '#',
                                text: name,
                                class: 'question-link' })
          link.click(function(x) {
            openQuestion(name);
            var link = this;
            _.forEach($('.question-link-active'),
                      function(x) { x.className = 'question-link'; });
            link.className = 'question-link-active';
          });
          return link;
        });
  _.forEach(links, function(link) {
    _.forEach([link, ' '], function(x) { $('#questions-row').append(x); });
  });
  if (links.length)
    links[0].click();
}

function openQuestion(qname)
{
  var p = SeashellProject.currentProject;
  var result = $.Deferred();
  socket.listProject(p.name).done(function(files) {
    function attach_dir_listing_to_node(dir, parent) {
      function basename(z) { return z.split('.')[0]; }
      function extension(z) { return z.split('.')[1]; }
      function dirname(z) {
        return z.substring(0, z.length - /\/[^\/]+$/.exec(z)[0].length);
      }
      var dfiles =
        _.chain(files)
          .filter(function(x) { return !x[1] && dirname(x[0]) == dir; })
            .map(function(x) { return /[^\/]+$/.exec(x[0])[0]; })
              .value();
      function has_source_buddy(x)
      {
        return ['c', 'h'].indexOf(extension(x)) >= 0 &&
          _.find(dfiles,
                 function(y) { return x != y && basename(x) == basename(y); });
      }
      function make_file_link(x, caption)
      {
        caption = caption || x;
        var link = $('<a>', { href: '#',
                              text: caption,
                              class: 'file-link',
                              style: 'text-decoration: none'});
        link.click(function() {
          var link = this;
          p.openFilePath(dir + '/' + x);
          _.forEach($('.file-link-active'),
                    function(x) { x.className = 'file-link'; });
          link.className = 'file-link-active';
        });
        return link;
      }

      parent.empty();
      return _.chain(dfiles)
        .map(function(x) {
          var span = $('<span>', { style: 'margin-right: 30px' });
          if (!has_source_buddy(x))
          {
            var link = make_file_link(x);
            span.append(link);
            parent.append(span);
            return link;
          }
          if ('c' != extension(x))
            return null;
          var link = make_file_link(x, basename(x) + ' c');
          span.append(link);
          span.append('<span style="color: #aaa; font-size: 12px">,</span>');
          span.append(make_file_link(basename(x) + '.h', 'h'));
          parent.append(span);
          return link;
        })
          .filter(_.identity).value();
    }

    $('#question-files-list-title').text(qname + '/');
    $('#folder-option-current-question').text(qname);

    var question_files =
          attach_dir_listing_to_node(qname, $('#question-files-row'));
    if (question_files.length)
      question_files[0].click();
    attach_dir_listing_to_node('common', $('#common-files-row'));
    attach_dir_listing_to_node(qname + '/tests', $('#test-files-row'));
    p.currentQuestion = qname;

    result.resolve();
  });

  return result;
}
